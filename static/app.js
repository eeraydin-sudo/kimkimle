/**
 * Kim Kiminle - Frontend Application
 * WebSocket-based multiplayer party game
 * Game Design Document: game-design.md
 */

// ============== Constants (from GDD) ==============

const ANSWER_TIMER_SECONDS = 30;
const RECONNECT_TIMEOUT_SECONDS = 30;
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;

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
    maxReconnectAttempts: 5,
    hasAnswered: false,
    submittedAnswer: '',
    timerInterval: null,
    expiresAt: 0
};

// ============== DOM Elements ==============

const elements = {
    screens: {
        entry: document.getElementById('screen-entry'),
        createNickname: document.getElementById('screen-create-nickname'),
        joinNickname: document.getElementById('screen-join-nickname'),
        lobby: document.getElementById('screen-lobby'),
        question: document.getElementById('screen-question'),
        waiting: document.getElementById('screen-waiting'),
        reveal: document.getElementById('screen-reveal'),
        finished: document.getElementById('screen-finished'),
        disconnected: document.getElementById('screen-disconnected')
    },
    inputs: {
        roomCode: document.getElementById('room-code'),
        createNickname: document.getElementById('create-nickname'),
        joinNickname: document.getElementById('join-nickname'),
        answer: document.getElementById('answer-input')
    },
    buttons: {
        create: document.getElementById('btn-create'),
        join: document.getElementById('btn-join'),
        createRoom: document.getElementById('btn-create-room'),
        joinRoom: document.getElementById('btn-join-room'),
        copyCode: document.getElementById('btn-copy-code'),
        startGame: document.getElementById('btn-start-game'),
        submitAnswer: document.getElementById('btn-submit-answer'),
        leaveLobby: document.getElementById('btn-leave-lobby'),
        playAgain: document.getElementById('btn-play-again'),
        exit: document.getElementById('btn-exit'),
        prevStory: document.getElementById('btn-prev-story'),
        nextStory: document.getElementById('btn-next-story')
    },
    displays: {
        roomCode: document.getElementById('room-code-display'),
        joinRoomCodeDisplay: document.getElementById('join-room-code-display'),
        playerCount: document.getElementById('player-count'),
        playerList: document.getElementById('player-list'),
        hostControls: document.getElementById('host-controls'),
        playerWaiting: document.getElementById('player-waiting'),
        questionText: document.getElementById('question-text'),
        currentQuestionNum: document.getElementById('current-question-num'),
        totalQuestions: document.getElementById('total-questions'),
        timerNum: document.getElementById('timerNum'),
        timerArc: document.getElementById('timerArc'),
        waitingForList: document.getElementById('waiting-for-list'),
        storiesContainer: document.getElementById('stories-container'),
        storyCounter: document.getElementById('story-counter'),
        finishedControls: document.getElementById('finished-controls'),
        reconnectCountdown: document.getElementById('reconnect-countdown'),
        charCount: document.getElementById('charCount'),
        navDots: document.getElementById('navDots')
    },
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
    console.log('[DEBUG] sendEvent called - event:', event, '| ws:', state.ws ? 'exists' : 'null', '| readyState:', state.ws ? state.ws.readyState : 'N/A');
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({ event, ...data }));
        console.log('[DEBUG] Event sent successfully');
    } else {
        console.log('[DEBUG] Event NOT sent - WebSocket not open');
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
        case 'waiting':
            handleWaiting(data);
            break;
        case 'reveal_results':
            handleRevealResults(data);
            break;
        case 'story_changed':
            handleStoryChanged(data);
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
        case 'game_reset':
            handleGameReset(data);
            break;
        case 'error':
            showToast(data.message, 'error');
            // If room not found, stop reconnection attempts
            if (data.message === 'Oda bulunamadı') {
                state.maxReconnectAttempts = 0;  // Stop reconnecting
                showToast('Oyun sona erdi. Lütfen yeni bir oda oluşturun.', 'info');
            }
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

    // Keep the existing WebSocket connection - just update message handler
    if (state.ws) {
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
    }
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

    // Keep the existing WebSocket connection - just update message handler
    if (state.ws) {
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
    }
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

function updateCharCount() {
    const len = elements.inputs.answer.value.length;
    elements.displays.charCount.textContent = `${len} / 100`;
    elements.displays.charCount.className = `char-count ${len > 80 ? (len >= 100 ? 'over' : 'near') : ''}`;
}

function handleGameStarted(data) {
    console.log('[DEBUG] handleGameStarted received:', data);
    state.questions = data.questions;
    state.totalQuestions = data.questions.length;
    state.currentQuestionIndex = 0;
    state.hasAnswered = false;
    state.submittedAnswer = '';
    // Use local timer - don't depend on server time which has latency
    state.timer = ANSWER_TIMER_SECONDS;
    console.log('[DEBUG] Timer initialized to:', state.timer);

    elements.displays.totalQuestions.textContent = state.totalQuestions;
    elements.inputs.answer.disabled = false;
    elements.inputs.answer.value = '';
    updateCharCount();
    elements.buttons.submitAnswer.disabled = false;

    document.getElementById('submittedOverlay').classList.remove('visible');
    document.getElementById('questionCard').style.display = 'block';
    document.getElementById('bottomBar').style.display = 'block';

    startLocalTimer();
    showScreen('question');
}

function handleNextQuestion(data) {
    console.log('[DEBUG] handleNextQuestion received, timer_seconds:', data.timer_seconds);
    // Use local timer tracking instead of server expires_at to avoid latency issues
    state.timer = data.timer_seconds || ANSWER_TIMER_SECONDS;
    state.currentQuestionIndex = data.question_index;  // Sync with server
    state.hasAnswered = false;  // Reset for new question
    state.submittedAnswer = '';

    console.log('[DEBUG] Timer set to:', state.timer);
    state.currentQuestionIndex = data.question_index;  // Sync with server
    state.hasAnswered = false;  // Reset for new question
    state.submittedAnswer = '';

    elements.displays.questionText.textContent = data.question;
    elements.displays.currentQuestionNum.textContent = state.currentQuestionIndex + 1;
    elements.inputs.answer.value = '';
    elements.inputs.answer.disabled = false;
    updateCharCount();
    elements.buttons.submitAnswer.disabled = false;

    document.getElementById('submittedOverlay').classList.remove('visible');
    document.getElementById('questionCard').style.display = 'block';
    document.getElementById('bottomBar').style.display = 'block';

    elements.inputs.answer.focus();

    startLocalTimer();
    showScreen('question');
}

function startLocalTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
    }

    const update = () => {
        // Count down from the timer value instead of calculating from expires_at
        state.timer = Math.max(0, state.timer - 1);
        updateTimerDisplay();
        console.log('[DEBUG] Timer tick:', state.timer);

        if (state.timer <= 0) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    };

    update(); // Initial call
    state.timerInterval = setInterval(update, 1000);
}

function handleTimerTick(data) {
    // This is now handled locally, but keeping the signature for safety during transition
    // if any old packets arrive.
}

function updateTimerDisplay() {
    elements.displays.timerNum.textContent = state.timer;

    const totalCircumference = 188.5;
    const percentage = state.timer / ANSWER_TIMER_SECONDS;
    const offset = totalCircumference - (percentage * totalCircumference);
    elements.displays.timerArc.style.strokeDashoffset = offset;

    elements.displays.timerArc.classList.remove('urgent');
    elements.displays.timerNum.classList.remove('urgent');

    if (state.timer <= 5) {
        elements.displays.timerArc.classList.add('urgent');
        elements.displays.timerNum.classList.add('urgent');
    }
}

function handleWaiting(data) {
    // Only show waiting screen when all answers are collected
    // If there are still players waiting, just show a toast
    if (data.waiting_for.length > 0) {
        // Still waiting for some players - don't switch screen
        // Just show a status message in the question screen
        const waitingNames = data.waiting_for.map(n => escapeHtml(n)).join(', ');  // ESCAPED
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
    state.currentStoryIndex = data.reveal_index || 0;
    state.isHost = data.host_id === state.playerId;

    renderStories();
    updateStoryNavigation();
    showScreen('reveal');
}

function handleStoryChanged(data) {
    state.currentStoryIndex = data.current_story_index;
    updateStoryNavigation();
}

function handlePlayerDisconnected(data) {
    const safeNickname = escapeHtml(data.nickname);  // ESCAPED
    showToast(`${safeNickname} bağlantısı koptu. Yeniden bağlanması bekleniyor... (${data.reconnect_timeout}sn)`, 'warning');
}

function handlePlayerReconnected(data) {
    const safeNickname = escapeHtml(data.nickname);  // ESCAPED
    showToast(`${safeNickname} yeniden bağlandı!`, 'success');
}

function handlePlayerLeft(data) {
    updatePlayerList(data.players);
    const safeNickname = escapeHtml(data.nickname);  // ESCAPED
    showToast(`${safeNickname} odadan ayrıldı.`, 'info');
}

function handleHostChanged(data) {
    const safeNewHost = escapeHtml(data.new_host);  // ESCAPED
    showToast(`${safeNewHost} artık host!`, 'info');

    if (data.new_host === state.nickname) {
        state.isHost = true;
        updateLobbyUI();
    }
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
        const safeNickname = escapeHtml(player.nickname);  // ESCAPED for XSS

        li.innerHTML = `
            <div class="player-avatar">${initial}</div>
            <span class="player-name">${safeNickname}</span>
            ${player.is_host ? '<span class="player-badge">Host</span>' : ''}
            ${!player.is_connected ? '<span class="player-badge reconnecting">Bağlanıyor...</span>' : ''}
        `;

        elements.displays.playerList.appendChild(li);
    });

    // Update start button state (min 2 players per GDD)
    const connectedCount = players.filter(p => p.is_connected).length;
    console.log('[DEBUG] Button state update - connectedCount:', connectedCount, '| MIN_PLAYERS:', MIN_PLAYERS);
    elements.buttons.startGame.disabled = connectedCount < MIN_PLAYERS;
    console.log('[DEBUG] Start button disabled:', elements.buttons.startGame.disabled);
}

function updateLobbyUI() {
    console.log('[DEBUG] updateLobbyUI called - isHost:', state.isHost);
    if (state.isHost) {
        elements.displays.hostControls.classList.remove('hidden');
        elements.displays.playerWaiting.classList.add('hidden');
        elements.displays.finishedControls.classList.remove('hidden');
    } else {
        elements.displays.hostControls.classList.add('hidden');
        elements.displays.playerWaiting.classList.remove('hidden');
        elements.displays.finishedControls.classList.add('hidden');
    }
}

function renderStories() {
    elements.displays.storiesContainer.innerHTML = '';
    elements.displays.navDots.innerHTML = ''; // Clear nav dots

    const questionsMap = [
        "Kim?", "Kiminle?", "Nerede?", "Ne zaman?", "Ne Yapıyor?", "Kim Görmüş?", "Ne Demiş?"
    ];

    state.stories.forEach((story, index) => {
        // Create story card
        const storyCard = document.createElement('div');
        storyCard.className = `story-card ${index === state.currentStoryIndex ? '' : 'hidden'}`;
        storyCard.dataset.index = index;

        // Ornament & Number
        const headerHtml = `
            <div class="card-ornament">
                <div class="ornament-line"></div>
                <div class="ornament-diamond"></div>
                <div class="ornament-line right"></div>
            </div>
            <div class="story-num text-center">HİKAYE ${index + 1}</div>
        `;

        let storyBodyHtml = '<div class="story-body">';
        let fullStoryText = '';

        story.parts.forEach((part, partIndex) => {
            const answer = escapeHtml(part.answer);  // ESCAPED for XSS
            const q = questionsMap[partIndex] || `Soru ${partIndex + 1}`;

            // For full story, format words inline
            let suffix = '';
            if (partIndex === 0) suffix = ', ';
            else if (partIndex === 1) suffix = ' ile, ';
            else if (partIndex === 2) suffix = ', ';
            else if (partIndex === 3) suffix = ', ';
            else if (partIndex === 4) suffix = '. ';
            else if (partIndex === 5) suffix = ' gördü. ';
            else if (partIndex === 6) suffix = ' dedi.';

            fullStoryText += ` <strong>${answer}</strong>${suffix}`;

            storyBodyHtml += `
                <div class="story-line" style="animation-delay: ${0.2 + (partIndex * 0.1)}s">
                    <div class="line-question">${q}</div>
                    <div class="line-answer" style="filter: blur(4px); transition: filter 0.8s ease; animation: removeBlur 0.8s ${0.3 + (partIndex * 0.1)}s forwards;">${answer}</div>
                </div>
            `;
        });
        storyBodyHtml += '</div>';

        const fullStoryHtml = `<div class="story-full">${fullStoryText.trim()}</div>`;

        storyCard.innerHTML = headerHtml + storyBodyHtml + fullStoryHtml;
        elements.displays.storiesContainer.appendChild(storyCard);

        // Create matching dot
        const dot = document.createElement('div');
        dot.className = `nav-dot ${index === state.currentStoryIndex ? 'active' : ''}`;
        dot.dataset.index = index;
        if (state.isHost) {
            dot.addEventListener('click', () => {
                sendEvent('change_story', { new_index: index });
            });
        }
        elements.displays.navDots.appendChild(dot);
    });

    // Add keyframes dynamically if not exists
    if (!document.getElementById('removeBlurStyles')) {
        const style = document.createElement('style');
        style.id = 'removeBlurStyles';
        style.innerHTML = `@keyframes removeBlur { to { filter: blur(0); } }`;
        document.head.appendChild(style);
    }

    updateStoryNavigation();
}

function updateStoryNavigation() {
    const total = state.stories.length;
    elements.displays.storyCounter.textContent = `Hikaye ${state.currentStoryIndex + 1} / ${total}`;

    // Update dots
    Array.from(elements.displays.navDots.children).forEach((dot, index) => {
        dot.classList.toggle('active', index === state.currentStoryIndex);
    });

    // Only host can see and use navigation buttons
    if (state.isHost) {
        elements.buttons.prevStory.classList.remove('hidden');
        elements.buttons.nextStory.classList.remove('hidden');
        elements.buttons.prevStory.disabled = state.currentStoryIndex === 0;
        elements.buttons.nextStory.disabled = state.currentStoryIndex >= total - 1;

        if (state.currentStoryIndex === total - 1) {
            elements.displays.finishedControls.classList.add('visible');
        } else {
            elements.displays.finishedControls.classList.remove('visible');
        }
    } else {
        elements.buttons.prevStory.classList.add('hidden');
        elements.buttons.nextStory.classList.add('hidden');
    }

    // Show/hide stories
    elements.displays.storiesContainer.querySelectorAll('.story-card').forEach((story, index) => {
        story.classList.toggle('hidden', index !== state.currentStoryIndex);
    });
}

// ============== Event Handlers ==============

// Show Create Nickname Screen
elements.buttons.create.addEventListener('click', () => {
    showScreen('createNickname');
    elements.inputs.createNickname.focus();
});

// Show Join Nickname Screen (after validating room code)
elements.buttons.join.addEventListener('click', () => {
    let roomCode = elements.inputs.roomCode.value.trim().toUpperCase();

    // Validate: must be exactly 4 alphanumeric characters
    const roomCodeRegex = /^[A-Z0-9]{4}$/;
    if (!roomCodeRegex.test(roomCode)) {
        showToast('Oda kodu 4 karakter olmalı (harf veya rakam)', 'error');
        elements.inputs.roomCode.focus();
        return;
    }

    state.roomCode = roomCode;
    elements.displays.joinRoomCodeDisplay.textContent = roomCode;
    showScreen('joinNickname');
    elements.inputs.joinNickname.focus();
});

// Create Room (after entering nickname)
elements.buttons.createRoom.addEventListener('click', async () => {
    const nickname = elements.inputs.createNickname.value.trim();

    if (!nickname) {
        showToast('Lütfen takma adını gir', 'error');
        elements.inputs.createNickname.focus();
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

        state.ws.onclose = (event) => {
            console.log('WebSocket closed during room creation', event);
            if (state.playerId) {
                // Room was created, try to reconnect
                if (state.reconnectAttempts < state.maxReconnectAttempts) {
                    state.reconnectAttempts++;
                    showToast(`Bağlantı koptu, yeniden bağlanıyor...`, 'error');
                    setTimeout(() => {
                        connectWebSocket(state.playerId);
                    }, 2000);
                } else {
                    showScreen('disconnected');
                    startReconnectCountdown();
                }
            } else {
                // Room wasn't created yet
                showToast('Bağlantı koptu, lütfen tekrar deneyin', 'error');
                showScreen('entry');
            }
        };

        state.ws.onerror = (error) => {
            console.error('WebSocket error during room creation:', error);
            showToast('Bağlantı hatası', 'error');
        };

    } catch (error) {
        showToast('Oda oluşturulamadı', 'error');
        console.error(error);
    }
});

// Join Room (after entering nickname)
elements.buttons.joinRoom.addEventListener('click', async () => {
    const nickname = elements.inputs.joinNickname.value.trim();

    if (!nickname) {
        showToast('Lütfen takma adını gir', 'error');
        elements.inputs.joinNickname.focus();
        return;
    }

    const roomCode = state.roomCode;

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

        state.ws.onclose = (event) => {
            console.log('WebSocket closed during room join', event);
            if (state.playerId) {
                // Room was joined, try to reconnect
                if (state.reconnectAttempts < state.maxReconnectAttempts) {
                    state.reconnectAttempts++;
                    showToast(`Bağlantı koptu, yeniden bağlanıyor...`, 'error');
                    setTimeout(() => {
                        connectWebSocket(state.playerId);
                    }, 2000);
                } else {
                    showScreen('disconnected');
                    startReconnectCountdown();
                }
            } else {
                // Room wasn't joined yet
                showToast('Bağlantı koptu, lütfen tekrar deneyin', 'error');
                showScreen('entry');
            }
        };

        state.ws.onerror = (error) => {
            console.error('WebSocket error during room join:', error);
            showToast('Bağlantı hatası', 'error');
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
console.log('[DEBUG] Start button clicked - isHost:', state.isHost, '| connectedPlayers:', state.players ? state.players.filter(p => p.is_connected).length : 0);
elements.buttons.startGame.addEventListener('click', () => {
    console.log('[DEBUG] Start game clicked - checking conditions');
    sendEvent('start_game');
});

// Input char limit
elements.inputs.answer.addEventListener('input', () => {
    updateCharCount();
});

// Submit Answer
console.log('[DEBUG] Setting up submit answer handler');
elements.buttons.submitAnswer.addEventListener('click', () => {
    if (state.hasAnswered) return;

    const answer = elements.inputs.answer.value.trim();
    if (!answer) return;

    console.log('[DEBUG] Submitting answer:', answer);
    sendEvent('submit_answer', { answer });
    state.hasAnswered = true;
    state.submittedAnswer = answer;

    // Show submitted overlay
    document.getElementById('questionCard').style.display = 'none';
    document.getElementById('submittedOverlay').classList.add('visible');
    elements.buttons.submitAnswer.disabled = true;
    document.getElementById('bottomBar').style.display = 'none';
});

// Enter key for answer submission (use keydown instead of keypress to catch Enter reliably in textarea)
elements.inputs.answer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!state.hasAnswered) {
            elements.buttons.submitAnswer.click();
        }
    }
});

// Leave Lobby
elements.buttons.leaveLobby.addEventListener('click', () => {
    sendEvent('leave_room');
    state.ws.close();
    showScreen('entry');
});

// Story Navigation - Prev Button
if (elements.buttons.prevStory) {
    elements.buttons.prevStory.addEventListener('click', () => {
        console.log('[DEBUG] Prev story button clicked');
        console.log('[DEBUG] state.isHost:', state.isHost);
        console.log('[DEBUG] state.currentStoryIndex:', state.currentStoryIndex);
        console.log('[DEBUG] state.stories.length:', state.stories.length);

        // Remove the isHost check - let the server validate
        if (state.currentStoryIndex > 0) {
            sendEvent('change_story', { direction: 'prev' });
        }
    });
}

// Story Navigation - Next Button
if (elements.buttons.nextStory) {
    elements.buttons.nextStory.addEventListener('click', () => {
        console.log('[DEBUG] Next story button clicked');
        console.log('[DEBUG] state.isHost:', state.isHost);
        console.log('[DEBUG] state.currentStoryIndex:', state.currentStoryIndex);
        console.log('[DEBUG] state.stories.length:', state.stories.length);

        // Remove the isHost check - let the server validate
        if (state.stories.length > 0 && state.currentStoryIndex < state.stories.length - 1) {
            sendEvent('change_story', { direction: 'next' });
        }
    });
}

// Play Again
if (elements.buttons.playAgain) {
    elements.buttons.playAgain.addEventListener('click', () => {
        sendEvent('play_again');
    });
}

// Exit
if (elements.buttons.exit) {
    elements.buttons.exit.addEventListener('click', () => {
        sendEvent('leave_room');
        if (state.ws) {
            state.ws.close();
        }
        showScreen('entry');
    });
}

// Room code input formatting
if (elements.inputs.roomCode) {
    elements.inputs.roomCode.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    showScreen('entry');
    elements.inputs.roomCode.focus();
});
