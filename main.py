"""
Kim Kiminle - Web Tabanlı Çok Oyunculu Parti Oyunu
FastAPI + WebSocket Backend
Game Design Document: game-design.md
"""

import asyncio
import random
import string
import time
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from collections import defaultdict

app = FastAPI(title="Kim Kiminle")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")


# ============== Health Check (for Render.com) ==============

@app.get("/health")
async def health_check():
    """Health check endpoint for Render.com deployment"""
    return {"status": "healthy"}


# ============== Constants (from GDD) ==============

MIN_PLAYERS = 2
MAX_PLAYERS = 8
ROOM_CODE_LENGTH = 4
ANSWER_TIMER_SECONDS = 20
RECONNECT_TIMEOUT_SECONDS = 30
MAX_ANSWER_LENGTH = 100
MAX_NICKNAME_LENGTH = 20
RATE_LIMIT_PER_IP = 50  # events per second - increased for same-IP testing


# ============== Data Models ==============

class GameState(Enum):
    LOBBY = "lobby"
    PLAYING = "playing"
    REVEAL = "reveal"
    FINISHED = "finished"


@dataclass
class Player:
    id: str
    nickname: str
    websocket: WebSocket
    is_host: bool = False
    is_connected: bool = True
    reconnect_timeout: float = 0
    current_answer: str = ""


@dataclass
class Room:
    code: str
    host_id: str
    players: Dict[str, Player] = field(default_factory=dict)
    state: GameState = GameState.LOBBY
    questions: List[str] = field(default_factory=list)
    current_question_index: int = 0
    answers: Dict[int, Dict[str, str]] = field(default_factory=dict)  # question_index -> {player_id: answer}
    timer_task: Optional[asyncio.Task] = None
    timer_remaining: int = ANSWER_TIMER_SECONDS
    stories: List[Dict] = field(default_factory=list)
    reveal_index: int = 0
    expires_at: float = 0
    
    def get_player_list(self) -> List[dict]:
        return [
            {"id": p.id, "nickname": p.nickname, "is_host": p.is_host, "is_connected": p.is_connected}
            for p in self.players.values()
        ]
    
    def get_connected_players(self) -> List[Player]:
        return [p for p in self.players.values() if p.is_connected]


# ============== Rate Limiter ==============

class RateLimiter:
    def __init__(self):
        self.ip_events: Dict[str, List[float]] = defaultdict(list)
    
    def is_allowed(self, ip: str) -> bool:
        """Check if IP is within rate limit"""
        now = time.time()
        # Remove events older than 1 second
        self.ip_events[ip] = [t for t in self.ip_events[ip] if now - t < 1.0]
        
        if len(self.ip_events[ip]) >= RATE_LIMIT_PER_IP:
            return False
        
        self.ip_events[ip].append(now)
        return True
    
    def cleanup(self):
        """Periodic cleanup of old entries"""
        now = time.time()
        for ip in list(self.ip_events.keys()):
            self.ip_events[ip] = [t for t in self.ip_events[ip] if now - t < 1.0]
            if not self.ip_events[ip]:
                del self.ip_events[ip]


# ============== Game Manager ==============

class GameManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.player_rooms: Dict[str, str] = {}  # player_id -> room_code
        self.ip_connections: Dict[str, Set[str]] = {}  # ip -> set of player_ids
        self.rate_limiter = RateLimiter()
    
    def generate_room_code(self) -> str:
        """Generate 4-character alphanumeric room code"""
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=ROOM_CODE_LENGTH))
            if code not in self.rooms:
                return code
    
    def create_room(self, host_nickname: str, websocket: WebSocket, client_ip: str) -> Room:
        room_code = self.generate_room_code()
        host_id = self._generate_player_id()
        
        host = Player(
            id=host_id,
            nickname=self._sanitize_nickname(host_nickname),
            websocket=websocket,
            is_host=True
        )
        
        room = Room(
            code=room_code,
            host_id=host_id,
            questions=self._get_default_questions()
        )
        room.players[host_id] = host
        
        self.rooms[room_code] = room
        self.player_rooms[host_id] = room_code
        self._track_ip_connection(client_ip, host_id)
        
        return room
    
    def join_room(self, room_code: str, nickname: str, websocket: WebSocket, client_ip: str) -> Player:
        room_code = room_code.upper()
        if room_code not in self.rooms:
            raise ValueError("Oda bulunamadı")
        
        room = self.rooms[room_code]
        
        if len(room.get_connected_players()) >= MAX_PLAYERS:
            raise ValueError("Oda dolu")
        
        player_id = self._generate_player_id()
        player = Player(
            id=player_id,
            nickname=self._sanitize_nickname(nickname),
            websocket=websocket,
            is_host=False
        )
        
        room.players[player_id] = player
        self.player_rooms[player_id] = room_code
        self._track_ip_connection(client_ip, player_id)
        
        return player
    
    def leave_room(self, player_id: str):
        if player_id not in self.player_rooms:
            return
        
        room_code = self.player_rooms[player_id]
        room = self.rooms.get(room_code)
        
        if room and player_id in room.players:
            player = room.players[player_id]
            
            # Handle host transfer
            if player.is_host:
                self._transfer_host(room)
            
            # Delete from player_rooms first, then remove from room.players completely
            del self.player_rooms[player_id]
            del room.players[player_id]
            
            # Check if room is empty
            if not room.get_connected_players():
                del self.rooms[room_code]
        else:
            # Player not in room, just clean up player_rooms
            if player_id in self.player_rooms:
                del self.player_rooms[player_id]
    
    def get_room(self, room_code: str) -> Optional[Room]:
        return self.rooms.get(room_code.upper())
    
    def get_player_room(self, player_id: str) -> Optional[Room]:
        if player_id in self.player_rooms:
            return self.rooms.get(self.player_rooms[player_id])
        return None
    
    def _generate_player_id(self) -> str:
        return ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    
    def _sanitize_nickname(self, nickname: str) -> str:
        """Sanitize nickname: max 20 chars, not empty"""
        nickname = nickname.strip()[:MAX_NICKNAME_LENGTH]
        if not nickname:
            nickname = f"Oyuncu{random.randint(100, 999)}"
        return nickname
    
    def _get_default_questions(self) -> List[str]:
        """Default 7 questions from GDD"""
        return [
            "Kim?",
            "Kiminle?",
            "Nerede?",
            "Ne zaman?",
            "Ne Yapıyor?",
            "Kim Görmüş?",
            "Ne Demiş?"
        ]
    
    def _transfer_host(self, room: Room):
        """Transfer host to random connected player"""
        connected = room.get_connected_players()
        if connected:
            new_host = random.choice(connected)
            new_host.is_host = True
            room.host_id = new_host.id
            
            # Remove host from old player
            for p in room.players.values():
                if p.id != new_host.id:
                    p.is_host = False
    
    def _track_ip_connection(self, ip: str, player_id: str):
        if ip not in self.ip_connections:
            self.ip_connections[ip] = set()
        self.ip_connections[ip].add(player_id)


game_manager = GameManager()


# ============== WebSocket Manager ==============

class ConnectionManager:
    async def send_personal(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except:
            pass
    
    async def broadcast(self, message: dict, room: Room):
        for player in room.get_connected_players():
            await self.send_personal(message, player.websocket)
    
    async def broadcast_except(self, message: dict, room: Room, except_player_id: str):
        for player in room.get_connected_players():
            if player.id != except_player_id:
                await self.send_personal(message, player.websocket)


manager = ConnectionManager()


# ============== Game Logic ==============

async def start_game(room: Room):
    """Start the game - called when host clicks start"""
    room.state = GameState.PLAYING
    room.current_question_index = 0
    room.timer_remaining = ANSWER_TIMER_SECONDS
    room.answers = {}
    room.stories = []
    room.expires_at = time.time() + ANSWER_TIMER_SECONDS
    
    all_questions = room.questions
    
    await manager.broadcast({
        "event": "game_started",
        "questions": all_questions,
        "expires_at": room.expires_at
    }, room)
    
    await send_next_question(room)


async def send_next_question(room: Room):
    """Send next question to all players"""
    all_questions = room.questions
    
    print(f"send_next_question: index={room.current_question_index}, total={len(all_questions)}")
    
    if room.current_question_index >= len(all_questions):
        print(f"All questions done, starting reveal for room {room.code}")
        await start_reveal(room)
        return
    
    room.timer_remaining = ANSWER_TIMER_SECONDS
    
    room.expires_at = time.time() + ANSWER_TIMER_SECONDS
    
    question_data = {
        "event": "next_question",
        "question": all_questions[room.current_question_index],
        "question_index": room.current_question_index,
        "total": len(all_questions),
        "expires_at": room.expires_at
    }
    print(f"Sending next_question: {question_data}")
    
    await manager.broadcast(question_data, room)
    
    # Start timer
    room.timer_task = asyncio.create_task(timer_tick(room))


async def timer_tick(room: Room):
    """Silent countdown - proceeds to collect answers when time expires"""
    try:
        # Wait until the expiration time
        while True:
            now = time.time()
            remaining = room.expires_at - now
            if remaining <= 0 or room.state != GameState.PLAYING:
                break
            # Sleep in small chunks but not every second to be efficient, or just wait the whole duration
            await asyncio.sleep(min(remaining, 1.0))
        
        if room.state == GameState.PLAYING:
            room.timer_task = None
            await collect_answers(room, from_timer=True)
    except asyncio.CancelledError:
        # Timer was cancelled (e.g., all players answered)
        print(f"Timer cancelled for room {room.code}")
        raise
    except Exception as e:
        print(f"Timer error for room {room.code}: {e}")
        room.timer_task = None


async def collect_answers(room: Room, from_timer: bool = False):
    """Collect all answers (dash for those who didn't answer)"""
    print(f"collect_answers called for room {room.code}, from_timer={from_timer}")
    
    # Cancel timer if still running and not called from timer itself
    if not from_timer and room.timer_task:
        room.timer_task.cancel()
        room.timer_task = None
    
    # Initialize answer dict for this question
    if room.current_question_index not in room.answers:
        room.answers[room.current_question_index] = {}
    
    # Collect all answers ("-" for those who didn't answer in time)
    for player in room.get_connected_players():
        if player.id not in room.answers[room.current_question_index]:
            # Use "-" for players who didn't answer in time
            room.answers[room.current_question_index][player.id] = player.current_answer or "-"
            print(f"Player {player.nickname} didn't answer, using '-'")
        player.current_answer = ""
    
    # Show waiting screen briefly
    await manager.broadcast({
        "event": "waiting",
        "waiting_for": []
    }, room)
    
    print(f"Moving to next question from index {room.current_question_index}")
    
    # Move to next question
    room.current_question_index += 1
    await asyncio.sleep(1)
    await send_next_question(room)


async def submit_answer(room: Room, player: Player, answer: str):
    """Handle answer submission from player"""
    # Limit answer to 100 characters per GDD
    player.current_answer = answer[:MAX_ANSWER_LENGTH]
    
    if room.current_question_index not in room.answers:
        room.answers[room.current_question_index] = {}
    
    room.answers[room.current_question_index][player.id] = player.current_answer
    
    # Check if all players have answered
    connected_ids = {p.id for p in room.get_connected_players()}
    answered_ids = set(room.answers[room.current_question_index].keys())
    
    if connected_ids == answered_ids:
        # All answered - move to next question
        if room.timer_task:
            room.timer_task.cancel()
            room.timer_task = None
        
        await manager.broadcast({
            "event": "waiting",
            "waiting_for": []
        }, room)
        
        room.current_question_index += 1
        await asyncio.sleep(1)
        await send_next_question(room)
    else:
        # Show who's still answering
        waiting_for = [p.nickname for p in room.get_connected_players() 
                      if p.id not in answered_ids]
        await manager.broadcast({
            "event": "waiting",
            "waiting_for": waiting_for
        }, room)


async def start_reveal(room: Room):
    """Start the reveal phase - show all stories"""
    room.state = GameState.REVEAL
    
    # Generate stories using paper folding algorithm
    stories = generate_stories(room)
    room.stories = stories
    
    await manager.broadcast({
        "event": "reveal_results",
        "stories": stories,
        "reveal_index": room.reveal_index
    }, room)


def generate_stories(room: Room) -> List[Dict]:
    """
    Paper folding algorithm: Each player's answer goes to a different "virtual paper"
    ensuring no player sees their own sentence continuation.
    
    Per GDD Section 5.4: Classic game's secrecy logic simulated via server-side 
    shifting algorithm.
    """
    all_questions = room.questions
    connected_players = room.get_connected_players()
    player_ids = [p.id for p in connected_players]
    player_names = {p.id: p.nickname for p in connected_players}
    
    num_players = len(player_ids)
    num_questions = len(all_questions)
    
    if num_players < 2:
        return []
    
    # Create rotation offset for each question
    # Player i's answer to question j goes to story (i + j) mod num_players
    stories = []
    
    for story_idx in range(num_players):
        story_parts = []
        
        for q_idx in range(num_questions):
            # Find which player's answer goes to this story for this question
            source_player_idx = (story_idx - q_idx) % num_players
            source_player_id = player_ids[source_player_idx]
            
            answer = room.answers.get(q_idx, {}).get(source_player_id, "...")
            story_parts.append({
                "question": all_questions[q_idx],
                "answer": answer,
                "player_nickname": player_names[source_player_id]
            })
        
        # Build the story text
        story_text = " ".join([part["answer"] for part in story_parts])
        
        stories.append({
            "story_index": story_idx,
            "parts": story_parts,
            "full_story": story_text
        })
    
    return stories


async def reset_game(room: Room):
    """Reset game for 'Play Again' - same room code"""
    room.state = GameState.LOBBY
    room.current_question_index = 0
    room.answers = {}
    room.stories = []
    
    for player in room.players.values():
        player.current_answer = ""
    
    await manager.broadcast({
        "event": "game_reset",
        "players": room.get_player_list()
    }, room)


# ============== WebSocket Handler ==============

async def handle_reconnection(player_id: str, websocket: WebSocket, room: Room):
    """Handle player reconnection within 30 seconds per GDD"""
    player = room.players.get(player_id)
    if player and not player.is_connected:
        player.websocket = websocket
        player.is_connected = True
        player.reconnect_timeout = 0
        
        await manager.broadcast({
            "event": "player_reconnected",
            "nickname": player.nickname
        }, room)
        
        await manager.broadcast({
            "event": "room_updated",
            "players": room.get_player_list()
        }, room)
        
        return True
    return False


@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    await websocket.accept()
    
    # Get client IP for connection tracking and rate limiting
    client_host = websocket.client.host if websocket.client else "unknown"
    
    room = game_manager.get_player_room(player_id)
    player = None
    
    # Check if this is a new connection (temp ID) or reconnection
    is_new_connection = player_id.startswith("temp_")
    
    if is_new_connection:
        # Wait for create_room or join_room event
        try:
            data = await websocket.receive_json()
            event = data.get("event")
            
            # Rate limiting check
            if not game_manager.rate_limiter.is_allowed(client_host):
                await manager.send_personal({
                    "event": "error",
                    "message": "Çok fazla istek. Lütfen bekleyin."
                }, websocket)
                await websocket.close()
                return
            
            if event == "create_room":
                nickname = data.get("nickname", "Oyuncu")
                room = game_manager.create_room(nickname, websocket, client_host)
                player = room.players[room.host_id]
                
                await manager.send_personal({
                    "event": "room_created",
                    "player_id": player.id,
                    "room_code": room.code,
                    "nickname": player.nickname,
                    "players": room.get_player_list()
                }, websocket)
                
                # Update player_id reference
                player_id = player.id
                
            elif event == "join_room":
                room_code = data.get("room_code", "").upper()
                nickname = data.get("nickname", "Oyuncu")
                
                try:
                    player = game_manager.join_room(room_code, nickname, websocket, client_host)
                    room = game_manager.get_room(room_code)
                    player_id = player.id
                    
                    await manager.send_personal({
                        "event": "room_joined",
                        "player_id": player.id,
                        "room_code": room.code,
                        "nickname": player.nickname,
                        "players": room.get_player_list()
                    }, websocket)
                    
                    # Notify others
                    await manager.broadcast_except({
                        "event": "room_updated",
                        "players": room.get_player_list()
                    }, room, player.id)
                    
                except ValueError as e:
                    await manager.send_personal({
                        "event": "error",
                        "message": str(e)
                    }, websocket)
                    await websocket.close()
                    return
            else:
                await manager.send_personal({
                    "event": "error",
                    "message": "Geçersiz bağlantı"
                }, websocket)
                await websocket.close()
                return
                
        except Exception as e:
            await manager.send_personal({
                "event": "error",
                "message": str(e)
            }, websocket)
            await websocket.close()
            return
    
    else:
        # Existing player - handle reconnection
        room = game_manager.get_player_room(player_id)
        
        if not room:
            await manager.send_personal({
                "event": "error",
                "message": "Oda bulunamadı"
            }, websocket)
            await websocket.close()
            return
        
        player = room.players.get(player_id)
        
        if not player:
            await manager.send_personal({
                "event": "error",
                "message": "Oyuncu bulunamadı"
            }, websocket)
            await websocket.close()
            return
        
        # Handle reconnection
        if not player.is_connected:
            player.websocket = websocket
            player.is_connected = True
            
            await manager.broadcast({
                "event": "player_reconnected",
                "nickname": player.nickname
            }, room)
            
            await manager.broadcast({
                "event": "room_updated",
                "players": room.get_player_list()
            }, room)
            
            # Send current game state
            if room.state == GameState.PLAYING:
                all_questions = room.questions
                await manager.send_personal({
                    "event": "game_started",
                    "questions": all_questions
                }, websocket)
                
                await manager.send_personal({
                    "event": "next_question",
                    "question": all_questions[room.current_question_index],
                    "question_index": room.current_question_index,
                    "total": len(all_questions),
                    "expires_at": room.expires_at
                }, websocket)
        else:
            player.websocket = websocket
    
    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
            
            # Rate limiting check
            if not game_manager.rate_limiter.is_allowed(client_host):
                await manager.send_personal({
                    "event": "error",
                    "message": "Çok fazla istek. Lütfen bekleyin."
                }, websocket)
                continue
            
            if event == "start_game":
                if player.is_host and room.state == GameState.LOBBY:
                    if len(room.get_connected_players()) >= MIN_PLAYERS:
                        await start_game(room)
                    else:
                        await manager.send_personal({
                            "event": "error",
                            "message": f"Oyunu başlatmak için en az {MIN_PLAYERS} oyuncu gerekli"
                        }, websocket)
            
            elif event == "submit_answer":
                if room.state == GameState.PLAYING:
                    answer = data.get("answer", "")
                    await submit_answer(room, player, answer)
            
            elif event == "change_story":
                if player.is_host and room.state == GameState.REVEAL:
                    direction = data.get("direction")
                    if direction == "next" and room.reveal_index < len(room.stories) - 1:
                        room.reveal_index += 1
                    elif direction == "prev" and room.reveal_index > 0:
                        room.reveal_index -= 1
                    
                    await manager.broadcast_to_room(room.code, {
                        "event": "story_changed",
                        "current_story_index": room.reveal_index
                    })
            

            
            elif event == "play_again":
                if player.is_host and room.state == GameState.REVEAL:
                    await reset_game(room)
            
            elif event == "leave_room":
                game_manager.leave_room(player_id)
                await websocket.close()
                break
    
    except WebSocketDisconnect:
        # Check if player already left via leave_room
        room = game_manager.get_player_room(player_id)
        if not room:
            return  # Player already cleanly exited via leave_room
        
        player.is_connected = False
        player.reconnect_timeout = time.time() + RECONNECT_TIMEOUT_SECONDS
        
        await manager.broadcast({
            "event": "player_disconnected",
            "nickname": player.nickname,
            "reconnect_timeout": RECONNECT_TIMEOUT_SECONDS
        }, room)
        
        # Start reconnection timer (30 seconds per GDD)
        asyncio.create_task(handle_disconnect_timeout(room, player_id))


async def handle_disconnect_timeout(room: Room, player_id: str):
    """Wait 30 seconds for reconnection before removing player (per GDD Section 7.1)"""
    await asyncio.sleep(RECONNECT_TIMEOUT_SECONDS)
    
    player = room.players.get(player_id)
    if player and not player.is_connected:
        nickname = player.nickname
        
        # Transfer host if needed
        if player.is_host:
            game_manager._transfer_host(room)
            new_host = room.players.get(room.host_id)
            if new_host:
                await manager.broadcast({
                    "event": "host_changed",
                    "new_host": new_host.nickname
                }, room)
        
        # Remove player from room
        if player_id in room.players:
            del room.players[player_id]
        
        if player_id in game_manager.player_rooms:
            del game_manager.player_rooms[player_id]
        
        await manager.broadcast({
            "event": "player_left",
            "nickname": nickname,
            "players": room.get_player_list()
        }, room)


# ============== HTTP Routes ==============

@app.get("/")
async def root():
    return FileResponse("static/index.html")


class CreateRoomRequest(BaseModel):
    nickname: str


class JoinRoomRequest(BaseModel):
    room_code: str
    nickname: str


@app.post("/api/create-room")
async def api_create_room(request: CreateRoomRequest):
    # This just validates and returns info - actual connection via WebSocket
    room_code = game_manager.generate_room_code()
    return {"room_code": room_code, "nickname": request.nickname}


@app.post("/api/join-room")
async def api_join_room(request: JoinRoomRequest):
    room = game_manager.get_room(request.room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Oda bulunamadı")
    
    if len(room.get_connected_players()) >= MAX_PLAYERS:
        raise HTTPException(status_code=400, detail="Oda dolu")
    
    return {"room_code": room.code, "nickname": request.nickname}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
