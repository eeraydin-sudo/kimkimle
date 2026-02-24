/**
 * Kim Kiminle - Frontend Application
 * WebSocket-based multiplayer party game
 * Game Design Document: game-design.md
 */

// ============== Constants (from GDD) ==============

const ANSWER_TIMER_SECONDS = 35;
const RECONNECT_TIMEOUT_SECONDS = 30;
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 3;

// ============== State Management ==============

const state = {
    playerId: null,
    nickname: '',
    roomCode: '',
    isHost: false,
    players: [],
    questions: [],
    currentQuestionIndex: 0,
    totalQuestions: 0,
    timer: ANSWER_TIMER_SECONDS,
    stories: [],
    currentStoryIndex: 0,
    ws: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5
};

// ============== DOM Elements ==============

const elements = {
    screens: {
        entry: document.getElementById('screen-entry'),
        join: document.getElementById('screen-join'),
        lobby: document.getElementById('screen-lobby'),
        question: document.getElementById('screen-question'),
        waiting: document.getElementById('screen-waiting'),
        reveal: document.getElementById('screen-reveal'),
        finished: document.getElementById('screen-finished'),
        disconnected: document.getElementById('screen-disconnected')
    },
    inputs: {
        nickname: document.getElementById('nickname'),
        roomCode: document.getElementById('room-code'),
        joinNickname: document.getElementById('join-nickname'),
        answer: document.getElementById('answer-input'),
        newQuestion: document.getElementById('new-question')
    },
    buttons: {
        create: document.getElementById('btn-create'),
        join: document.getElementById('btn-join'),
        joinRoom: document.getElementById('btn-join-room'),
        copyCode: document.getElementById('btn-copy-code'),
        startGame: document.getElementById('btn-start-game'),
        submitAnswer: document.getElementById('btn-submit-answer'),
        addQuestion: document.getElementById('btn-add-question'),
        leaveLobby: document.getElementById('btn-leave-lobby'),
        playAgain: document.getElementById('btn-play-again'),
        exit: document.getElementById('btn-exit'),
        prevStory: document.getElementById('btn-prev-story'),
        nextStory: document.getElementById('btn-next-story')
    },
    displays: {
        roomCode: document.getElementById('room-code-display'),
        playerCount: document.getElementById('player-count'),
        playerList: document.getElementById('player-list'),
        questionList: document.getElementById('question-list'),
        hostControls: document.getElementById('host-controls'),
        playerWaiting: document.getElementById('player-waiting'),
        questionText: document.getElementById('question-text'),
        currentQuestionNum: document.getElementById('current-question-num'),
        totalQuestions: document.getElementById('total-questions'),
        timerValue: document.getElementById('timer-value'),
        timer: document.getElementById('timer'),
        waitingForList: document.getElementById('waiting-for-list'),
        storiesContainer: document.getElementById('stories-container'),
        storyCounter: document.getElementById('story-counter'),
        finishedControls: document.getElementById('finished-controls'),
        reconnectCountdown: document.getElementById('reconnect-countdown')
    },
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// ============== Screen Management ==============

function showScreen(screenName) {
    Object.values(elements.screens).forEach(screen => {
        screen.classList.remove('active');
    });

    if (elements.screens[screenName]) {
        elements.screens[screenName].classList.add('active');
    }
}

// ============== Toast Notifications ==============

function showToast(message, type = 'info') {
    elements.toast.className = `toast ${type}`;
    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('hidden');

    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// ============== WebSocket Connection ==============

function connectWebSocket(playerId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${playerId}`;

    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
        console.log('WebSocket connected');
        state.reconnectAttempts = 0;
    };

    state.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    state.ws.onclose = (event) => {
        console.log('WebSocket closed', event);

        if (state.reconnectAttempts < state.maxReconnectAttempts) {
            state.reconnectAttempts++;
            showToast(`Bağlantı koptu, yeniden bağlanıyor... (${state.reconnectAttempts}/${state.maxReconnectAttempts})`, 'error');

            setTimeout(() => {
                connectWebSocket(state.playerId);
            }, 2000);
        } else {
            showScreen('disconnected');
            startReconnectCountdown();
        }
    };

    state.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        showToast('Bağlantı hatası', 'error');
    };
}

function startReconnectCountdown() {
    let countdown = RECONNECT_TIMEOUT_SECONDS;
    elements.displays.reconnectCountdown.textContent = countdown;

    const interval = setInterval(() => {
        countdown--;
        elements.displays.reconnectCountdown.textContent = countdown;

        if (countdown <= 0) {
            clearInterval(interval);
            showScreen('entry');
            showToast('Bağlantı zaman aşımına uğradı', 'error');
        }
    }, 1000);
}

function sendEvent(event, data = {}) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({ event, ...data }));
    }
}

// ============== WebSocket Message Handlers ==============

function handleWebSocketMessage(data) {
    console.log('Received:', data);

    switch (data.event) {
        case 'room_created':
            handleRoomCreated(data);
            break;
        case 'room_joined':
            handleRoomJoined(data);
            break;
        case 'room_updated':
            handleRoomUpdated(data);
            break;
        case 'game_started':
            handleGameStarted(data);
            break;
        case 'next_question':
            handleNextQuestion(data);
            break;
        case 'timer_tick':
            handleTimerTick(data);
            break;
        case 'waiting':
            handleWaiting(data);
            break;
        case 'reveal_results':
            handleRevealResults(data);
            break;
        case 'player_disconnected':
            handlePlayerDisconnected(data);
            break;
        case 'player_reconnected':
            handlePlayerReconnected(data);
            break;
        case 'player_left':
            handlePlayerLeft(data);
            break;
        case 'host_changed':
            handleHostChanged(data);
            break;
        case 'questions_updated':
            handleQuestionsUpdated(data);
            break;
        case 'game_reset':
            handleGameReset(data);
            break;
        case 'error':
            showToast(data.message, 'error');
            break;
    }
}

function handleRoomCreated(data) {
    state.playerId = data.player_id;
    state.roomCode = data.room_code;
    state.nickname = data.nickname;
    state.isHost = true;

    elements.displays.roomCode.textContent = state.roomCode;
    updatePlayerList(data.players);

    showScreen('lobby');
    updateLobbyUI();
    connectWebSocket(state.playerId);
}

function handleRoomJoined(data) {
    state.playerId = data.player_id;
    state.roomCode = data.room_code;
    state.nickname = data.nickname;
    state.isHost = false;

    elements.displays.roomCode.textContent = state.roomCode;
    updatePlayerList(data.players);

    showScreen('lobby');
    updateLobbyUI();
    connectWebSocket(state.playerId);
}

function handleRoomUpdated(data) {
    updatePlayerList(data.players);

    // Check if current player is now host
    const currentPlayer = data.players.find(p => p.id === state.playerId);
    if (currentPlayer) {
        state.isHost = currentPlayer.is_host;
        updateLobbyUI();
    }
}

function handleGameStarted(data) {
    state.questions = data.questions;
    state.totalQuestions = data.questions.length;
    state.currentQuestionIndex = 0;

    elements.displays.totalQuestions.textContent = state.totalQuestions;

    showScreen('question');
}

function handleNextQuestion(data) {
    state.currentQuestionIndex = data.question_index;
    state.timer = data.remaining_seconds || ANSWER_TIMER_SECONDS;

    elements.displays.questionText.textContent = data.question;
    elements.displays.currentQuestionNum.textContent = state.currentQuestionIndex + 1;
    elements.inputs.answer.value = '';
    elements.inputs.answer.focus();

    updateTimerDisplay();
    showScreen('question');
}

function handleTimerTick(data) {
    state.timer = data.remaining_seconds;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    elements.displays.timerValue.textContent = state.timer;

    elements.displays.timer.classList.remove('warning', 'danger');

    if (state.timer <= 5) {
        elements.displays.timer.classList.add('danger');
    } else if (state.timer <= 10) {
        elements.displays.timer.classList.add('warning');
    }
}

function handleWaiting(data) {
    // Only show waiting screen when all answers are collected
    // If there are still players waiting, just show a toast
    if (data.waiting_for.length > 0) {
        // Still waiting for some players - don't switch screen
        // Just show a status message in the question screen
        const waitingNames = data.waiting_for.join(', ');
        showToast(`Bekleniyor: ${waitingNames}`, 'info');
        return;
    }

    // All answers collected - show waiting screen briefly
    elements.displays.waitingForList.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = '✓ Tüm cevaplar alındı!';
    elements.displays.waitingForList.appendChild(li);

    showScreen('waiting');
}

function handleRevealResults(data) {
    state.stories = data.stories;
    state.currentStoryIndex = 0;

    renderStories();
    showScreen('reveal');
}

function handlePlayerDisconnected(data) {
    showToast(`${data.nickname} bağlantısı koptu. Yeniden bağlanması bekleniyor... (${data.reconnect_timeout}sn)`, 'warning');
}

function handlePlayerReconnected(data) {
    showToast(`${data.nickname} yeniden bağlandı!`, 'success');
}

function handlePlayerLeft(data) {
    updatePlayerList(data.players);
    showToast(`${data.nickname} odadan ayrıldı.`, 'info');
}

function handleHostChanged(data) {
    showToast(`${data.new_host} artık host!`, 'info');

    if (data.new_host === state.nickname) {
        state.isHost = true;
        updateLobbyUI();
    }
}

function handleQuestionsUpdated(data) {
    state.questions = data.questions;
    renderQuestionList();
}

function handleGameReset(data) {
    state.currentQuestionIndex = 0;
    state.stories = [];

    updatePlayerList(data.players);
    showScreen('lobby');
    updateLobbyUI();
}

// ============== UI Updates ==============

function updatePlayerList(players) {
    state.players = players;
    elements.displays.playerCount.textContent = players.length;

    elements.displays.playerList.innerHTML = '';

    players.forEach(player => {
        const li = document.createElement('li');
        li.className = player.is_connected ? '' : 'disconnected';

        const initial = player.nickname.charAt(0).toUpperCase();

        li.innerHTML = `
            <div class="player-avatar">${initial}</div>
            <span class="player-name">${player.nickname}</span>
            ${player.is_host ? '<span class="player-badge">Host</span>' : ''}
            ${!player.is_connected ? '<span class="player-badge reconnecting">Bağlanıyor...</span>' : ''}
        `;

        elements.displays.playerList.appendChild(li);
    });

    // Update start button state (min 3 players per GDD)
    const connectedCount = players.filter(p => p.is_connected).length;
    elements.buttons.startGame.disabled = connectedCount < MIN_PLAYERS;
}

function updateLobbyUI() {
    if (state.isHost) {
        elements.displays.hostControls.classList.remove('hidden');
        elements.displays.playerWaiting.classList.add('hidden');
        elements.displays.finishedControls.classList.remove('hidden');
    } else {
        elements.displays.hostControls.classList.add('hidden');
        elements.displays.playerWaiting.classList.remove('hidden');
        elements.displays.finishedControls.classList.add('hidden');
    }

    renderQuestionList();
}

function renderQuestionList() {
    elements.displays.questionList.innerHTML = '';

    state.questions.forEach((question, index) => {
        const li = document.createElement('li');
        const isCustom = index >= 6; // Default questions are 6

        li.className = isCustom ? 'custom' : '';
        li.innerHTML = `
            <span>${index + 1}. ${question}</span>
            ${isCustom && state.isHost ? `<button class="remove-btn" data-index="${index}">✕</button>` : ''}
        `;

        elements.displays.questionList.appendChild(li);
    });

    // Add remove event listeners
    elements.displays.questionList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            sendEvent('remove_question', { index });
        });
    });
}

function renderStories() {
    elements.displays.storiesContainer.innerHTML = '';

    state.stories.forEach((story, index) => {
        const storyDiv = document.createElement('div');
        storyDiv.className = `story ${index === state.currentStoryIndex ? '' : 'hidden'}`;
        storyDiv.dataset.index = index;

        let partsHtml = '';
        story.parts.forEach((part, partIndex) => {
            partsHtml += `
                <div class="story-part" style="animation-delay: ${partIndex * 0.5}s">
                    <span class="highlight">${part.answer}</span>
                    <span class="story-author">(${part.player_nickname})</span>
                </div>
            `;
        });

        storyDiv.innerHTML = `
            <div class="story-header">Hikaye ${index + 1}</div>
            <div class="story-text">${partsHtml}</div>
        `;

        elements.displays.storiesContainer.appendChild(storyDiv);
    });

    updateStoryNavigation();
}

function updateStoryNavigation() {
    const total = state.stories.length;
    elements.displays.storyCounter.textContent = `${state.currentStoryIndex + 1} / ${total}`;

    elements.buttons.prevStory.disabled = state.currentStoryIndex === 0;
    elements.buttons.nextStory.disabled = state.currentStoryIndex >= total - 1;

    // Show/hide stories
    elements.displays.storiesContainer.querySelectorAll('.story').forEach((story, index) => {
        story.classList.toggle('hidden', index !== state.currentStoryIndex);
    });
}

// ============== Event Handlers ==============

// Create Room
elements.buttons.create.addEventListener('click', async () => {
    const nickname = elements.inputs.nickname.value.trim();

    if (!nickname) {
        showToast('Lütfen takma adını gir', 'error');
        elements.inputs.nickname.focus();
        return;
    }

    try {
        const response = await fetch('/api/create-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname })
        });

        const data = await response.json();

        // Now connect via WebSocket to actually create the room
        // We'll use a temporary ID and let the server assign the real one
        const tempId = 'temp_' + Math.random().toString(36).substr(2, 9);
        state.nickname = nickname;

        // Connect and send create_room event
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${tempId}`;

        state.ws = new WebSocket(wsUrl);

        state.ws.onopen = () => {
            state.ws.send(JSON.stringify({
                event: 'create_room',
                nickname: nickname
            }));
        };

        state.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.event === 'room_created') {
                handleRoomCreated(data);
            } else {
                handleWebSocketMessage(data);
            }
        };

    } catch (error) {
        showToast('Oda oluşturulamadı', 'error');
        console.error(error);
    }
});

// Show Join Screen
elements.buttons.join.addEventListener('click', () => {
    showScreen('join');
    elements.inputs.roomCode.focus();
});

// Join Room
elements.buttons.joinRoom.addEventListener('click', async () => {
    const roomCode = elements.inputs.roomCode.value.trim().toUpperCase();
    const nickname = elements.inputs.joinNickname.value.trim();

    if (!roomCode || roomCode.length !== 4) {
        showToast('Geçerli bir oda kodu gir', 'error');
        elements.inputs.roomCode.focus();
        return;
    }

    if (!nickname) {
        showToast('Lütfen takma adını gir', 'error');
        elements.inputs.joinNickname.focus();
        return;
    }

    try {
        const response = await fetch('/api/join-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_code: roomCode, nickname })
        });

        if (!response.ok) {
            const error = await response.json();
            showToast(error.detail || 'Odaya katılınamadı', 'error');
            return;
        }

        const data = await response.json();

        // Connect via WebSocket
        const tempId = 'temp_' + Math.random().toString(36).substr(2, 9);
        state.nickname = nickname;
        state.roomCode = roomCode;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${tempId}`;

        state.ws = new WebSocket(wsUrl);

        state.ws.onopen = () => {
            state.ws.send(JSON.stringify({
                event: 'join_room',
                room_code: roomCode,
                nickname: nickname
            }));
        };

        state.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.event === 'room_joined') {
                handleRoomJoined(data);
            } else if (data.event === 'error') {
                showToast(data.message, 'error');
            } else {
                handleWebSocketMessage(data);
            }
        };

    } catch (error) {
        showToast('Odaya katılınamadı', 'error');
        console.error(error);
    }
});

// Copy Room Code
elements.buttons.copyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(state.roomCode).then(() => {
        showToast('Oda kodu kopyalandı!', 'success');
    }).catch(() => {
        showToast('Kopyalanamadı', 'error');
    });
});

// Start Game
elements.buttons.startGame.addEventListener('click', () => {
    sendEvent('start_game');
});

// Submit Answer
elements.buttons.submitAnswer.addEventListener('click', () => {
    const answer = elements.inputs.answer.value.trim();
    sendEvent('submit_answer', { answer });
    elements.inputs.answer.value = '';
});

// Enter key for answer submission
elements.inputs.answer.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.buttons.submitAnswer.click();
    }
});

// Add Question
elements.buttons.addQuestion.addEventListener('click', () => {
    const question = elements.inputs.newQuestion.value.trim();

    if (question) {
        sendEvent('add_question', { question });
        elements.inputs.newQuestion.value = '';
    }
});

// Enter key for adding question
elements.inputs.newQuestion.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.buttons.addQuestion.click();
    }
});

// Leave Lobby
elements.buttons.leaveLobby.addEventListener('click', () => {
    sendEvent('leave_room');
    state.ws.close();
    showScreen('entry');
});

// Story Navigation
elements.buttons.prevStory.addEventListener('click', () => {
    if (state.currentStoryIndex > 0) {
        state.currentStoryIndex--;
        updateStoryNavigation();
    }
});

elements.buttons.nextStory.addEventListener('click', () => {
    if (state.currentStoryIndex < state.stories.length - 1) {
        state.currentStoryIndex++;
        updateStoryNavigation();
    }
});

// Play Again
elements.buttons.playAgain.addEventListener('click', () => {
    sendEvent('play_again');
});

// Exit
elements.buttons.exit.addEventListener('click', () => {
    sendEvent('leave_room');
    if (state.ws) {
        state.ws.close();
    }
    showScreen('entry');
});

// Room code input formatting
elements.inputs.roomCode.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    showScreen('entry');
    elements.inputs.nickname.focus();
});
