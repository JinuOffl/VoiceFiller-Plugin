export class VoiceRhombusUI {
  constructor() {
    this.element = null;
    this.currentState = 'idle';
    this.wakeWordActive = false;
    this.wakeWordRecognition = null;
    this.isWakeWordListening = false;
    this.onWakeWordCallback = null;

    this.createUI();
    this.initializeWakeWordDetection();
    this.bindEvents();
    this.hide(); // hide on init
  }

  createUI() {
    const rhombusHTML = `
      <div class="voice-rhombus" id="voiceRhombus">
        <div class="rhombus-shape">
          <div class="center-element">
            <div class="white-ball">
              <!-- Jelly ball that morphs into different shapes -->
              <div class="jelly-core"></div>
              
              <!-- Typing dots (hidden by default, emerge from jelly ball) -->
              <div class="typing-dots">
                <span class="dot dot1"></span>
                <span class="dot dot2"></span>
                <span class="dot dot3"></span>
              </div>
              
              <!-- Orbiting dots for listening state -->
              <div class="orbit-container">
                <div class="orbit-dot orbit-dot1"></div>
                <div class="orbit-dot orbit-dot2"></div>
                <div class="orbit-dot orbit-dot3"></div>
              </div>
            </div>
          </div>
          <div class="ripple-container">
            <div class="ripple ripple1"></div>
            <div class="ripple ripple2"></div>
            <div class="ripple ripple3"></div>
          </div>
          <div class="wake-word-indicator"></div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = rhombusHTML;
    this.element = container.firstElementChild;
    this.injectStyles();
    document.body.appendChild(this.element);
  }

  injectStyles() {
    const styles = `
      .voice-rhombus {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        z-index: 999999;
        transform: rotate(45deg);
        opacity: 0;
        scale: 0.8;
        transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .voice-rhombus.visible {
        opacity: 1;
        scale: 1;
      }

      .rhombus-shape {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(10px);
      }

      .center-element {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        width: 36px;
        height: 36px;
      }

      .white-ball {
        width: 100%;
        height: 100%;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      /* JELLY CORE - The main morphing element */
      .jelly-core {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, #ffffff, #f0f0f0);
        box-shadow: 
          inset 0 2px 8px rgba(255, 255, 255, 0.8),
          inset 0 -2px 8px rgba(0, 0, 0, 0.1),
          0 4px 12px rgba(0, 0, 0, 0.15);
        transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        animation: idleBreathing 3s ease-in-out infinite;
        transform-origin: center center;
      }

      /* IDLE BREATHING ANIMATION */
      @keyframes idleBreathing {
        0%, 100% { 
          transform: scale(1) rotate(0deg);
          border-radius: 50%;
          filter: brightness(1);
        }
        50% { 
          transform: scale(1.05) rotate(1deg);
          border-radius: 48% 52% 50% 50% / 52% 48% 52% 48%;
          filter: brightness(1.1);
        }
      }

      /* TYPING DOTS */
      .typing-dots {
        position: absolute;
        display: flex;
        gap: 8px;
        opacity: 0;
        transform: scale(0);
        transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, #ffffff, #e0e0e0);
        box-shadow: 
          inset 0 1px 3px rgba(255, 255, 255, 0.8),
          0 2px 6px rgba(0, 0, 0, 0.2);
        transform: scale(0);
        animation: none;
      }

      @keyframes jellySplit {
        0% {
          transform: scale(0) translateY(0);
          opacity: 0;
        }
        20% {
          transform: scale(1.2) translateY(-2px);
          opacity: 1;
        }
        100% {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
      }

      @keyframes jellyBounce {
        0%, 80%, 100% { 
          transform: scale(1) translateY(0); 
          filter: brightness(1);
        }
        40% { 
          transform: scale(1.3) translateY(-4px); 
          filter: brightness(1.2);
        }
      }

      /* ORBITING DOTS FOR LISTENING */
      .orbit-container {
        position: absolute;
        width: 100%;
        height: 100%;
        opacity: 0;
        transform: scale(0);
        transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .orbit-dot {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, #ffffff, #e0e0e0);
        box-shadow: 
          inset 0 1px 2px rgba(255, 255, 255, 0.8),
          0 2px 6px rgba(102, 126, 234, 0.3),
          0 0 12px rgba(255, 255, 255, 0.4);
        top: 50%;
        left: 50%;
        transform-origin: 0 0;
      }

      .orbit-dot1 {
        animation: orbit1 2.5s linear infinite;
        transform: translate(-3px, -3px) rotate(0deg) translateX(18px) rotate(0deg);
      }

      .orbit-dot2 {
        animation: orbit2 3.2s linear infinite;
        transform: translate(-3px, -3px) rotate(120deg) translateX(14px) rotate(-120deg);
      }

      .orbit-dot3 {
        animation: orbit3 2.8s linear infinite;
        transform: translate(-3px, -3px) rotate(240deg) translateX(22px) rotate(-240deg);
      }

      @keyframes orbit1 {
        0% { 
          transform: translate(-3px, -3px) rotate(0deg) translateX(18px) rotate(0deg);
          opacity: 1;
        }
        50% { 
          opacity: 0.7;
          filter: brightness(1.2);
        }
        100% { 
          transform: translate(-3px, -3px) rotate(360deg) translateX(18px) rotate(-360deg);
          opacity: 1;
        }
      }

      @keyframes orbit2 {
        0% { 
          transform: translate(-3px, -3px) rotate(120deg) translateX(14px) rotate(-120deg);
          opacity: 0.8;
        }
        50% { 
          opacity: 1;
          filter: brightness(1.1);
        }
        100% { 
          transform: translate(-3px, -3px) rotate(480deg) translateX(14px) rotate(-480deg);
          opacity: 0.8;
        }
      }

      @keyframes orbit3 {
        0% { 
          transform: translate(-3px, -3px) rotate(240deg) translateX(22px) rotate(-240deg);
          opacity: 0.9;
        }
        50% { 
          opacity: 0.6;
          filter: brightness(1.3);
        }
        100% { 
          transform: translate(-3px, -3px) rotate(600deg) translateX(22px) rotate(-600deg);
          opacity: 0.9;
        }
      }

      /* RIPPLE EFFECTS */
      .ripple-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 120px;
        height: 120px;
        pointer-events: none;
      }

      .ripple {
        position: absolute;
        border: 2px solid rgba(255, 255, 255, 0.6);
        border-radius: 50%;
        width: 100%;
        height: 100%;
        opacity: 0;
        transform: scale(0);
        animation: none;
      }

      @keyframes sonarRipple {
        0% { 
          transform: scale(0.3); 
          opacity: 0.8;
          border-width: 3px;
        }
        50% { 
          opacity: 0.4;
          border-width: 2px;
        }
        100% { 
          transform: scale(1.8); 
          opacity: 0;
          border-width: 1px;
        }
      }

      .wake-word-indicator {
        position: absolute;
        top: -5px;
        right: -5px;
        width: 10px;
        height: 10px;
        background: radial-gradient(circle, #ff4757, #ff3742);
        border-radius: 50%;
        opacity: 0;
        transition: opacity 0.3s ease;
        box-shadow: 0 2px 8px rgba(255, 71, 87, 0.4);
      }

      /* BOUNCE ENTRANCE */
      @keyframes bounceIn {
        0% {
          opacity: 0;
          transform: rotate(45deg) scale(0.3);
        }
        50% {
          opacity: 1;
          transform: rotate(45deg) scale(1.1);
        }
        100% {
          opacity: 1;
          transform: rotate(45deg) scale(1);
        }
      }

      /* STATE TRANSITIONS */

      /* IDLE STATE */
      .voice-rhombus.idle .jelly-core {
        animation: idleBreathing 3s ease-in-out infinite;
        opacity: 1;
        transform: scale(1);
      }

      /* LISTENING STATE */
      .voice-rhombus.listening .jelly-core {
        animation: shrinkToCore 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        transform: scale(0.6);
      }

      .voice-rhombus.listening .orbit-container {
        opacity: 1;
        transform: scale(1);
        animation-delay: 0.4s;
      }

      @keyframes shrinkToCore {
        0% {
          border-radius: 50%;
          transform: scale(1);
          opacity: 1;
          filter: brightness(1);
        }
        50% {
          border-radius: 45% 55% 50% 50% / 55% 45% 50% 50%;
          transform: scale(0.8);
          opacity: 0.9;
          filter: brightness(1.1);
        }
        100% {
          border-radius: 50%;
          transform: scale(0.6);
          opacity: 1;
          filter: brightness(1.2);
          box-shadow: 
            inset 0 2px 8px rgba(255, 255, 255, 0.9),
            inset 0 -2px 8px rgba(0, 0, 0, 0.05),
            0 0 20px rgba(102, 126, 234, 0.3),
            0 4px 12px rgba(0, 0, 0, 0.15);
        }
      }

      /* SPEAKING STATE */
      .voice-rhombus.speaking .jelly-core {
        animation: speakingPulse 1.2s ease-in-out infinite;
        background: radial-gradient(circle at 30% 30%, #ffffff, #e8f4ff);
        box-shadow: 
          inset 0 2px 8px rgba(255, 255, 255, 0.9),
          0 4px 20px rgba(102, 126, 234, 0.3);
      }

      .voice-rhombus.speaking .ripple {
        animation: sonarRipple 2s ease-out infinite;
      }

      .voice-rhombus.speaking .ripple1 { animation-delay: 0s; }
      .voice-rhombus.speaking .ripple2 { animation-delay: 0.7s; }
      .voice-rhombus.speaking .ripple3 { animation-delay: 1.4s; }

      @keyframes speakingPulse {
        0%, 100% { 
          transform: scale(1);
          filter: brightness(1) saturate(1);
        }
        50% { 
          transform: scale(1.1);
          filter: brightness(1.15) saturate(1.2);
        }
      }

      /* TYPING STATE */
      .voice-rhombus.typing .jelly-core {
        animation: splitToDots 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }

      .voice-rhombus.typing .typing-dots {
        opacity: 1;
        transform: scale(1);
        animation-delay: 0.3s;
      }

      .voice-rhombus.typing .dot {
        animation: jellySplit 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                   jellyBounce 1.6s ease-in-out infinite 0.6s;
      }

      .voice-rhombus.typing .dot1 { animation-delay: 0s, 0.6s; }
      .voice-rhombus.typing .dot2 { animation-delay: 0.1s, 0.8s; }
      .voice-rhombus.typing .dot3 { animation-delay: 0.2s, 1s; }

      .voice-rhombus.typing .center-element {
        animation: typingBounce 1.2s ease-in-out infinite;
      }

      @keyframes splitToDots {
        0% {
          transform: scale(1);
          border-radius: 50%;
          opacity: 1;
        }
        50% {
          transform: scale(1.3);
          border-radius: 40% 60% 50% 50% / 60% 40% 50% 50%;
          opacity: 0.5;
        }
        100% {
          transform: scale(0);
          opacity: 0;
        }
      }

      @keyframes typingBounce {
        0%, 100% {
          transform: translate(-50%, -50%) scale(1) rotate(-45deg);
        }
        50% {
          transform: translate(-50%, -52%) scale(1.05) rotate(-45deg);
        }
      }

      /* WAKE WORD ACTIVE */
      .voice-rhombus.wake-active .wake-word-indicator {
        opacity: 1;
        animation: wakeWordPulse 1.5s ease-in-out infinite;
      }

      @keyframes wakeWordPulse {
        0%, 100% { 
          transform: scale(1);
          opacity: 1;
        }
        50% { 
          transform: scale(1.3);
          opacity: 0.7;
        }
      }

      /* SMOOTH SHOW/HIDE */
      .voice-rhombus.show-animation {
        animation: bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  setState(state) {
    // Remove all state classes
    this.element.classList.remove('idle', 'listening', 'speaking', 'typing');
    
    // Add new state with smooth transition
    this.element.classList.add(state);
    this.currentState = state;
    
    console.log(`🎤 Voice UI state changed to: ${state}`);
    
    // Add special transition effects
    if (state === 'listening') {
      this.playOrbitTransition();
    } else if (state === 'typing') {
      this.playSplitTransition();
    }
  }

  playOrbitTransition() {
    // Add subtle effect for orbit activation
    const orbitDots = this.element.querySelectorAll('.orbit-dot');
    orbitDots.forEach((dot, index) => {
      setTimeout(() => {
        dot.style.filter = 'brightness(1.5) drop-shadow(0 0 8px rgba(255,255,255,0.8))';
        setTimeout(() => {
          dot.style.filter = '';
        }, 200);
      }, index * 100);
    });
  }

  playSplitTransition() {
    // Enhance the split effect
    const dots = this.element.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
      setTimeout(() => {
        dot.style.transform = 'scale(1.2)';
        setTimeout(() => {
          dot.style.transform = 'scale(1)';
        }, 100);
      }, index * 50);
    });
  }

  show() {
    this.element.style.display = 'block';
    this.element.classList.add('visible', 'show-animation');
    
    // Remove animation class after animation completes
    setTimeout(() => {
      this.element.classList.remove('show-animation');
    }, 600);
  }

  hide() {
    this.element.classList.remove('visible');
    setTimeout(() => {
      this.element.style.display = 'none';
    }, 500);
  }

  setOnWakeWordCallback(callback) {
    this.onWakeWordCallback = callback;
  }

  startWakeWordDetection() {
    this.wakeWordActive = true;
    this.element.classList.add('wake-active');
    this.startWakeWordListening();
    console.log('🎤 Wake word detection started');
  }

  stopWakeWordDetection() {
    this.wakeWordActive = false;
    this.element.classList.remove('wake-active');
    this.stopWakeWordListening();
    console.log('🛑 Wake word detection stopped');
  }

  initializeWakeWordDetection() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('⚠️ Speech Recognition not supported');
      return;
    }

    this.wakeWordRecognition = new SpeechRecognition();
    this.wakeWordRecognition.continuous = true;
    this.wakeWordRecognition.interimResults = true;
    this.wakeWordRecognition.lang = 'en-US';

    this.wakeWordRecognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join(' ')
        .toLowerCase();

      if (transcript.includes('hey voice filler') || transcript.includes('voice filler')) {
        this.onWakeWordDetected();
      }
    };

    this.wakeWordRecognition.onerror = () => {
      if (this.wakeWordActive) {
        setTimeout(() => this.startWakeWordListening(), 1000);
      }
    };

    this.wakeWordRecognition.onend = () => {
      if (this.wakeWordActive && this.isWakeWordListening) {
        setTimeout(() => this.startWakeWordListening(), 200);
      }
    };
  }

  startWakeWordListening() {
    if (this.wakeWordRecognition && !this.isWakeWordListening) {
      try {
        this.wakeWordRecognition.start();
        this.isWakeWordListening = true;
      } catch (e) {
        console.error("Failed to start wake word listening:", e);
      }
    }
  }

  stopWakeWordListening() {
    if (this.wakeWordRecognition && this.isWakeWordListening) {
      this.wakeWordRecognition.stop();
      this.isWakeWordListening = false;
    }
  }

  onWakeWordDetected() {
    console.log('🎉 Wake word detected!');
    this.setState('listening');
    this.stopWakeWordListening();
    this.show();

    if (this.onWakeWordCallback) this.onWakeWordCallback();

    setTimeout(() => {
      if (this.wakeWordActive) {
        this.startWakeWordListening();
        this.setState('idle');
      }
    }, 6000);
  }

  bindEvents() {
    this.element.addEventListener('click', () => {
      if (this.currentState === 'idle' && this.onWakeWordCallback) {
        this.show();
        this.onWakeWordCallback();
      }
    });

    // Add smooth hover effects
    this.element.addEventListener('mouseenter', () => {
      if (this.currentState === 'idle') {
        const jellyCore = this.element.querySelector('.jelly-core');
        jellyCore.style.transform = 'scale(1.05)';
        jellyCore.style.filter = 'brightness(1.1)';
      }
    });

    this.element.addEventListener('mouseleave', () => {
      if (this.currentState === 'idle') {
        const jellyCore = this.element.querySelector('.jelly-core');
        jellyCore.style.transform = 'scale(1)';
        jellyCore.style.filter = 'brightness(1)';
      }
    });
  }

  destroy() {
    this.stopWakeWordDetection();
    if (this.element) {
      this.element.remove();
    }
  }
}