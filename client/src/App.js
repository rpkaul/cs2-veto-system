import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

// --- CONFIGURATION ---
const SOCKET_URL = window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin;

const LOGO_URL = "https://i.ibb.co/0yLfyyQt/LOT-LOGO-03.jpg";
const socket = io(SOCKET_URL);

// --- MAP PREFIX DETECTION ---
// Helper function to get the full map name with appropriate prefix
const getMapNameWithPrefix = (mapName) => {
    if (!mapName) return mapName;

    // If map name already contains a prefix (has underscore), return as is
    if (mapName.includes('_')) {
        return mapName.toLowerCase();
    }

    // Known defusal maps (de_ prefix)
    const defusalMaps = ['dust2', 'inferno', 'mirage', 'overpass', 'nuke', 'anubis', 'ancient', 'vertigo', 'cache', 'train', 'cobblestone', 'tuscan', 'sanctum', 'poseidon'];

    // Known hostage maps (cs_ prefix)
    const hostageMaps = ['office', 'assault', 'italy', 'militia'];

    // Known aim maps (aim_ prefix)
    const aimMaps = ['aim_map', 'aim_redline', 'aim_ag_texture2'];

    // Known awp maps (awp_ prefix)
    const awpMaps = ['awp_india', 'awp_lego_2', 'awp_map'];

    // Known ar_ maps (arms race)
    const arMaps = ['shoots', 'monastery', 'baggage', 'lake', 'stmarc', 'safehouse', 'sugarcane'];

    // Known bhop maps (bhop_ prefix)
    const bhopMaps = ['bhop_map', 'bhop_easy', 'bhop_hard'];

    // Known ze maps (ze_ prefix - zombie escape)
    const zeMaps = ['ze_map', 'ze_escape', 'ze_survival'];

    const lowerName = mapName.toLowerCase();

    // Check each category
    if (defusalMaps.some(m => lowerName.includes(m) || m.includes(lowerName))) {
        return `de_${lowerName}`;
    }
    if (hostageMaps.some(m => lowerName.includes(m) || m.includes(lowerName))) {
        return `cs_${lowerName}`;
    }
    if (aimMaps.some(m => lowerName.includes(m) || m.includes(lowerName))) {
        return `aim_${lowerName}`;
    }
    if (awpMaps.some(m => lowerName.includes(m) || m.includes(lowerName))) {
        return `awp_${lowerName}`;
    }
    if (arMaps.some(m => lowerName.includes(m) || m.includes(lowerName))) {
        return `ar_${lowerName}`;
    }
    if (bhopMaps.some(m => lowerName.includes(m) || m.includes(lowerName))) {
        return `bhop_${lowerName}`;
    }
    if (zeMaps.some(m => lowerName.includes(m) || m.includes(lowerName))) {
        return `ze_${lowerName}`;
    }

    // Default to de_ for unknown maps (most common)
    return `de_${lowerName}`;
};

// Helper function to get map image URL with prefix detection
const getMapImageUrl = (mapName, customImage = null) => {
    if (customImage) {
        return { primary: customImage, fallbacks: [] };
    }

    const mapWithPrefix = getMapNameWithPrefix(mapName);
    const baseName = mapWithPrefix.toLowerCase();
    const mapNameLower = mapName.toLowerCase();

    // Primary URL with new GitHub repository
    const primaryUrl = `https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${baseName}.png`;

    // Secondary fallback URLs - try all possible prefixes
    const prefixes = ['de_', 'ar_', 'cs_', 'awp_', 'aim_', 'bhop_', 'ze_'];
    const secondaryUrls = [];

    // Add fallback with detected prefix first
    secondaryUrls.push(`https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${baseName}.jpg`);

    // Try all other prefixes as fallbacks
    prefixes.forEach(prefix => {
        const prefixedName = `${prefix}${mapNameLower}`;
        if (prefixedName !== baseName) {
            secondaryUrls.push(`https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${prefixedName}.png`);
            secondaryUrls.push(`https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${prefixedName}.jpg`);
        }
    });

    // Legacy fallback URLs
    secondaryUrls.push(`https://image.gametracker.com/images/maps/160x120/csgo/${baseName}.jpg`);
    secondaryUrls.push(`https://image.gametracker.com/images/maps/160x120/csgo/de_${mapNameLower}.jpg`);

    return { primary: primaryUrl, fallbacks: secondaryUrls };
};

// --- UTILITIES ---
const getParams = () => {
    const params = new URLSearchParams(window.location.search);
    return { room: params.get('room'), key: params.get('key') };
};

const openInNewTab = (url) => window.open(url, '_blank', 'noopener,noreferrer');

// --- SOUND SYSTEM ---
const playSound = (type = 'action') => {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Calm and soft sounds for different actions
        switch (type) {
            case 'ban':
                oscillator.frequency.value = 220; // Softer lower pitch
                oscillator.type = 'sine'; // Changed from square to sine for softer sound
                gainNode.gain.setValueAtTime(0.08, audioContext.currentTime); // Much lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.15);
                break;
            case 'pick':
                oscillator.frequency.value = 330; // Pleasant higher pitch
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.08, audioContext.currentTime); // Much lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.12);
                break;
            case 'side':
                oscillator.frequency.value = 275; // Mid-range pleasant tone
                oscillator.type = 'sine'; // Changed from triangle to sine
                gainNode.gain.setValueAtTime(0.07, audioContext.currentTime); // Lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
                break;
            case 'ready':
                oscillator.frequency.value = 440; // Pleasant A note
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.06, audioContext.currentTime); // Lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.08);
                break;
            case 'coin':
                // Continuous coin spinning sound - metallic wobble effect
                const baseFreq = 200;
                const wobbleAmount = 30;
                const wobbleSpeed = 15; // How fast it wobbles
                const totalDuration = 0.1; // Duration of each wobble cycle

                // Create multiple oscillators for a richer, metallic sound
                for (let i = 0; i < 3; i++) {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext.destination);

                    // Different frequencies for harmonics
                    osc.frequency.setValueAtTime(baseFreq + (i * 50), audioContext.currentTime);
                    osc.type = i === 0 ? 'sine' : 'triangle'; // Mix of wave types

                    // Volume envelope
                    const startTime = audioContext.currentTime + (i * 0.03);
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.04 - (i * 0.01), startTime + 0.01);
                    gain.gain.linearRampToValueAtTime(0.04 - (i * 0.01), startTime + totalDuration - 0.01);
                    gain.gain.linearRampToValueAtTime(0, startTime + totalDuration);

                    // Add frequency wobble for spinning effect
                    for (let t = 0; t < totalDuration; t += 0.02) {
                        const wobble = Math.sin((t * wobbleSpeed) * Math.PI * 2) * wobbleAmount;
                        osc.frequency.setValueAtTime(
                            baseFreq + (i * 50) + wobble,
                            startTime + t
                        );
                    }

                    osc.start(startTime);
                    osc.stop(startTime + totalDuration);
                }
                return;
            case 'coinLoop':
                // Continuous spinning coin sound - loops during animation
                const baseFreq2 = 180;
                const wobbleAmount2 = 25;
                const wobbleSpeed2 = 12;
                const cycleDuration = 0.15;

                // Create metallic spinning sound with multiple oscillators
                for (let i = 0; i < 4; i++) {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    const filter = audioContext.createBiquadFilter();

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(audioContext.destination);

                    filter.type = 'lowpass';
                    filter.frequency.value = 500 + (i * 100);

                    const freq = baseFreq2 + (i * 40);
                    osc.type = i === 0 ? 'sine' : (i === 1 ? 'triangle' : 'sawtooth');

                    // Volume modulation for metallic wobble
                    const startTime2 = audioContext.currentTime;
                    gain.gain.setValueAtTime(0.03 - (i * 0.005), startTime2);
                    gain.gain.linearRampToValueAtTime(0, startTime2 + cycleDuration);

                    // Frequency wobble for spinning effect
                    for (let t = 0; t < cycleDuration; t += 0.01) {
                        const wobble = Math.sin((t * wobbleSpeed2) * Math.PI * 2) * wobbleAmount2;
                        osc.frequency.setValueAtTime(freq + wobble, startTime2 + t);
                    }

                    osc.start(startTime2);
                    osc.stop(startTime2 + cycleDuration);
                }
                return;
            case 'countdown':
                // Soft countdown tick sound
                oscillator.frequency.value = 400; // Pleasant tick tone
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // Very soft
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05); // Quick, soft fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.05);
                break;
            default:
                oscillator.frequency.value = 300; // Pleasant mid tone
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.07, audioContext.currentTime); // Lower volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12); // Softer fade
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.12);
        }
    } catch (e) {
        // Sound playback failed silently
    }
};

// --- COUNTDOWN COMPONENT ---
const Countdown = ({ endsAt, soundEnabled = false }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const prevTimeRef = useRef(null);

    useEffect(() => {
        if (!endsAt) {
            prevTimeRef.current = null;
            return;
        }

        // Initialize on first run
        const endsAtTime = typeof endsAt === 'number' ? endsAt : new Date(endsAt).getTime();
        const initialDiff = Math.floor((endsAtTime - Date.now()) / 1000);
        const initialTimeLeft = initialDiff > 0 ? initialDiff : 0;
        prevTimeRef.current = initialTimeLeft;
        setTimeLeft(initialTimeLeft);

        const interval = setInterval(() => {
            const endsAtTime = typeof endsAt === 'number' ? endsAt : new Date(endsAt).getTime();
            const diff = Math.floor((endsAtTime - Date.now()) / 1000);
            const newTimeLeft = diff > 0 ? diff : 0;

            // Play countdown sound from 10 to 0 (only when time decreases)
            if (soundEnabled && prevTimeRef.current !== null && newTimeLeft <= 10 && newTimeLeft >= 0 && newTimeLeft < prevTimeRef.current) {
                playSound('countdown');
            }

            prevTimeRef.current = newTimeLeft;
            setTimeLeft(newTimeLeft);
        }, 1000);
        return () => clearInterval(interval);
    }, [endsAt, soundEnabled]);

    if (!endsAt || timeLeft <= 0) return null;
    return <span style={{ color: timeLeft < 10 ? '#ff4444' : '#00d4ff', fontWeight: 'bold', marginLeft: '10px' }}>({timeLeft}s)</span>;
};

// --- ICONS ---
const ExternalLinkIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>);
const CheckIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const CopyIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
const HomeIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>);
const TrashIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const UploadIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>);
const RefreshIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>);
const UndoIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>);


// --- ANIMATED BACKGROUND ---
const AnimatedBackground = () => (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1, background: 'linear-gradient(160deg, #0a0a12 0%, #0d1117 40%, #0a0e1a 100%)' }}>
        {/* Diagonal accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', opacity: 0.4 }}>
            <div style={{ position: 'absolute', top: '-50%', left: '60%', width: '1px', height: '200%', background: 'linear-gradient(180deg, transparent 0%, rgba(0, 212, 255, 0.15) 30%, rgba(168, 85, 247, 0.1) 50%, transparent 70%)', transform: 'rotate(-35deg)', transformOrigin: 'top' }} />
            <div style={{ position: 'absolute', top: '-50%', left: '30%', width: '1px', height: '200%', background: 'linear-gradient(180deg, transparent 0%, rgba(255, 0, 85, 0.08) 40%, transparent 60%)', transform: 'rotate(-35deg)', transformOrigin: 'top' }} />
        </div>
        {/* Corner accent */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '40%', background: 'radial-gradient(ellipse at top right, rgba(0, 212, 255, 0.03) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '40%', height: '40%', background: 'radial-gradient(ellipse at bottom left, rgba(255, 0, 85, 0.02) 0%, transparent 60%)', pointerEvents: 'none' }} />
        {/* Dot grid */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.5 }} />
    </div>
);

const RulesModal = ({ format, onClose }) => {
    const getRules = () => {
        if (format.includes('wingman_bo1')) return ["WINGMAN Bo1:", "1. Team A Bans", "2. Team B Bans", "3. Team A Bans", "4. Team B Bans", "5. Team A Bans", "6. Last Map (Knife for Side)"];
        if (format.includes('wingman_bo3')) return ["WINGMAN Bo3:", "1. Team A Bans 2 maps", "2. Team A Picks 1 map (Team B picks side)", "3. Team B Picks 1 map (Team A picks side)", "4. Team B Bans 1 map", "5. Last Decider Map (Knife for Side)"];
        if (format.includes('faceit_bo1')) return ["FACEIT Bo1:", "1. Team A Bans 1", "2. Team B Bans 1", "3. Team A Bans 1", "4. Team B Bans 1", "5. Team A Bans 1", "6. Team B Bans 1", "7. Remaining Map (Knife for Side)"];
        if (format.includes('faceit_bo3')) return ["FACEIT Bo3:", "1. Team A Bans 1", "2. Team B Bans 1", "3. Team A Picks 1", "4. Team B Picks Side", "5. Team B Picks 1", "6. Team A Picks Side", "7. Team A Bans 1", "8. Team B Bans 1", "9. Decider Map (Knife for Side)"];
        if (format === 'bo1') return ["VRS Bo1:", "1. Team A Bans 2 maps", "2. Team B Bans 3 maps", "3. Team A Bans 1 map", "4. Leftover map is played, and Team B chooses the starting side"];
        if (format === 'bo3') return ["VRS Bo3:", "1. Team A Bans 1st Map", "2. Team B Bans 2nd Map", "3. Team A Picks 3rd Map ; Team B Chooses Side", "4. Team B Picks 4th Map ; Team A Chooses Side", "5. Team B Bans 5th Map", "6. Team A Bans 6th Map", "7. Leftover Map is played as the decider"];
        if (format === 'bo5' || format === 'faceit_bo5') return ["Bo5:", "1. Team A Bans 1st Map", "2. Team B Bans 2nd Map", "3. Team A Picks 3rd map; Team B chooses the starting side", "4. Team B Picks 4th map; Team A chooses the starting side", "5. Team A picks 5th map; Team B chooses the starting side", "6. Team B picks 6th map; Team A chooses the starting side", "7. Left over map is played as decider ; knife round"];
        if (format === 'custom') return ["This is a custom match with custom rules."];
        return [];
    };
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#0f1219', border: '2px solid #00d4ff', borderRadius: '15px', padding: '20px', width: '90%', maxWidth: '600px', textAlign: 'center' }}>
                <h2 style={{ color: '#fff', fontFamily: "'Rajdhani',sans-serif" }}>RULES: {format.toUpperCase().replace('_', ' ')}</h2>
                <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '10px', margin: '20px 0', color: '#ccc' }}>{getRules().map((r, i) => <div key={i}>{r}</div>)}</div>
                <button onClick={onClose} style={{ background: '#00d4ff', border: 'none', padding: '10px 30px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>OK</button>
            </div>
        </div>
    );
};

// --- LOG PARSER ---
const LogLineRenderer = ({ log, teamA, teamB }) => {
    const splitIndex = log.indexOf('(');
    let mainPart = log;
    let sidePart = "";

    if (splitIndex !== -1) {
        mainPart = log.substring(0, splitIndex).trim();
        sidePart = log.substring(splitIndex).trim();
    }

    const renderWord = (word, i) => {
        let style = { color: '#aaa' };
        if (['banned', 'picked'].includes(word.toLowerCase())) style = { color: '#666' };
        if (word === teamA) style = { color: '#00d4ff', fontWeight: 'bold' };
        if (word === teamB) style = { color: '#ff0055', fontWeight: 'bold' };
        if (word.includes('[BAN]')) style = { color: '#ff4444', fontWeight: 'bold' };
        if (word.includes('[PICK]')) style = { color: '#00ff00', fontWeight: 'bold' };
        return <span key={i} style={style}>{word} </span>;
    };

    return (
        <div style={{ marginBottom: '6px', fontFamily: "'Consolas', monospace", fontSize: '0.9rem', lineHeight: '1.5' }}>
            {mainPart.split(' ').map((w, i) => renderWord(w, i))}
            {sidePart && (
                <span style={{ color: '#00ff00', fontWeight: 'bold', marginLeft: '5px' }}>
                    {sidePart}
                </span>
            )}
        </div>
    );
};

// --- MAP CARD COMPONENT WITH IMAGE ERROR HANDLING ---
const MapCard = ({ map, isInteractive, onMouseEnter, onMouseLeave, onClick, actionColor, logData, mapOrderLabel, styles }) => {
    const mapImageUrls = getMapImageUrl(map.name, map.customImage);
    const initialUrl = mapImageUrls.primary;
    const [imageUrl, setImageUrl] = useState(initialUrl);
    const [imageFailed, setImageFailed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Extract complex expression to separate variable for useEffect dependency
    const fallbacksKey = mapImageUrls.fallbacks.join(',');

    // Test image loading
    useEffect(() => {
        if (map.customImage) {
            // Custom images are assumed to work
            setImageFailed(false);
            setImageUrl(initialUrl); // Ensure imageUrl is set for custom images
            return;
        }

        let testImage; // Declare testImage once
        let timeoutId;
        let currentIndex = -1; // Start before the first fallback to try primary first

        const allUrlsToTest = [initialUrl, ...mapImageUrls.fallbacks]; // Corrected declaration

        const tryNextUrl = () => {
            currentIndex++;
            if (currentIndex >= allUrlsToTest.length) {
                // All URLs failed
                setImageFailed(true);
                return;
            }

            const testUrl = allUrlsToTest[currentIndex];
            testImage = new Image(); // Create new image for each attempt

            testImage.onload = () => {
                clearTimeout(timeoutId);
                setImageUrl(testUrl); // Set the successfully loaded URL
                setImageFailed(false);
            };

            testImage.onerror = () => {
                clearTimeout(timeoutId);
                tryNextUrl(); // Try the next URL
            };

            timeoutId = setTimeout(() => {
                // If timeout, clear handlers and try next URL
                testImage.onload = null;
                testImage.onerror = null;
                tryNextUrl();
            }, 3000); // 3 second timeout per URL

            testImage.src = testUrl;
        };

        tryNextUrl();

        return () => {
            clearTimeout(timeoutId);
            testImage.onload = null;
            testImage.onerror = null;
        };
    }, [map.name, initialUrl, fallbacksKey, map.customImage, mapImageUrls.fallbacks]); // Dependencies

    // Generate fallback URLs for CSS
    const fallbackUrls = mapImageUrls.fallbacks.length > 0
        ? ', ' + mapImageUrls.fallbacks.map(url => `url(${url})`).join(', ')
        : '';

    const cardStyle = {
        ...styles.mapCard,
        backgroundImage: imageFailed
            ? 'linear-gradient(135deg, #0d0f18 0%, #111422 50%, #0a0e1a 100%)'
            : `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%), url(${imageUrl})${fallbackUrls}`,
        opacity: map.status === 'banned' ? 0.25 : 1,
        filter: map.status === 'banned' ? 'grayscale(100%) brightness(0.6)' : 'none',
        border: map.status === 'picked' ? '2px solid rgba(0, 255, 136, 0.5)' : map.status === 'decider' ? '2px solid rgba(255, 165, 0, 0.5)' : isInteractive ? `1px solid ${actionColor}44` : '1px solid rgba(255,255,255,0.04)',
        cursor: (map.status === 'available' && isInteractive) ? 'pointer' : 'default',
        boxShadow: (isInteractive && isHovered) ? `0 8px 24px ${actionColor}22, 0 0 0 1px ${actionColor}33` : map.status === 'picked' ? '0 4px 20px rgba(0,255,136,0.08)' : '0 4px 12px rgba(0,0,0,0.4)',
        transform: (isInteractive && isHovered) ? 'scale(1.04) translateY(-4px)' : 'scale(1)',
        position: 'relative'
    };

    return (
        <div
            onMouseEnter={() => { setIsHovered(true); onMouseEnter && onMouseEnter(); }}
            onMouseLeave={() => { setIsHovered(false); onMouseLeave && onMouseLeave(); }}
            onClick={onClick}
            style={cardStyle}
        >
            {imageFailed && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                    borderRadius: '10px',
                    padding: '20px',
                    textAlign: 'center',
                    zIndex: 1
                }}>
                    <div style={{
                        fontSize: '2rem',
                        color: '#888',
                        marginBottom: '10px',
                        opacity: 0.5
                    }}>🖼️</div>
                    <div style={{
                        fontSize: '0.85rem',
                        color: '#aaa',
                        marginBottom: '15px',
                        fontWeight: 'bold'
                    }}>MAP IMAGE NOT AVAILABLE</div>
                    <div style={{
                        fontSize: '1.2rem',
                        color: '#fff',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                    }}>{map.name}</div>
                </div>
            )}
            {map.status === 'picked' && mapOrderLabel && <div style={styles.mapOrderBadge}>{mapOrderLabel}</div>}
            <div style={styles.cardContent}>
                <span style={styles.mapTitle}>{map.name}</span>
                {map.status === 'banned' && <div style={styles.badgeBan}>BANNED BY {logData?.team || '...'}</div>}
                {map.status === 'picked' && <div style={styles.badgePick}>PICKED BY {logData?.team || '...'} <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING...'}</div></div>}
                {map.status === 'decider' && <div style={styles.badgeDecider}>DECIDER <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING FOR SIDE'}</div></div>}
            </div>
        </div>
    );
};

// --- COIN FLIP COMPONENT (FIXED VISUALS) ---
const CoinFlipOverlay = ({ gameState, myRole, onCall, onDecide, soundEnabled = true }) => {
    const [isFlipping, setIsFlipping] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [flipAnimation, setFlipAnimation] = useState(null);
    const soundIntervalRef = useRef(null);

    useEffect(() => {
        if (gameState.coinFlip.result && gameState.coinFlip.status === 'deciding') {
            // Generate random values for each flip
            const randomRotations = Math.floor(Math.random() * 1800) + 1800; // 1800-3600 degrees
            const randomDuration = (Math.random() * 1.5) + 2.5; // 2.5-4 seconds
            const randomXAxis = (Math.random() * 20) - 10; // -10 to 10 degrees
            const randomZAxis = (Math.random() * 20) - 10; // -10 to 10 degrees

            setFlipAnimation({
                rotations: randomRotations,
                duration: randomDuration,
                xAxis: randomXAxis,
                zAxis: randomZAxis
            });

            setIsFlipping(true);

            // Play spinning coin sound continuously during flip
            if (soundEnabled) {
                // Play initial coin sound
                playSound('coin');

                // Loop the spinning sound every 150ms during the animation
                soundIntervalRef.current = setInterval(() => {
                    playSound('coinLoop');
                }, 150);
            }

            setTimeout(() => {
                // Clear the sound interval
                if (soundIntervalRef.current) {
                    clearInterval(soundIntervalRef.current);
                    soundIntervalRef.current = null;
                }
                setIsFlipping(false);
                setShowResult(true);
            }, randomDuration * 1000);
        }

        // Cleanup on unmount or when component changes
        return () => {
            if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
                soundIntervalRef.current = null;
            }
        };
    }, [gameState.coinFlip.result, gameState.coinFlip.status, soundEnabled]);

    const isCaller = myRole === 'A';
    const isWinner = myRole === gameState.coinFlip.winner;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#0a0a12', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
            {/* Subtle background accents */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(255,215,0,0.03) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.03) 0%, transparent 70%)', borderRadius: '50%' }} />
                {/* Dot grid */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            </div>
            <style>
                {flipAnimation && `
                    @keyframes coinFlip3D {
                        0% {
                            transform: rotateY(0deg) rotateX(0deg) rotateZ(0deg) scale(1);
                            filter: brightness(1);
                        }
                        25% {
                            transform: rotateY(${flipAnimation.rotations * 0.25}deg) rotateX(${flipAnimation.xAxis}deg) rotateZ(${flipAnimation.zAxis}deg) scale(1.1);
                            filter: brightness(1.3);
                        }
                        50% {
                            transform: rotateY(${flipAnimation.rotations * 0.5}deg) rotateX(${-flipAnimation.xAxis}deg) rotateZ(${-flipAnimation.zAxis}deg) scale(0.95);
                            filter: brightness(0.8);
                        }
                        75% {
                            transform: rotateY(${flipAnimation.rotations * 0.75}deg) rotateX(${flipAnimation.xAxis * 0.5}deg) rotateZ(${flipAnimation.zAxis * 0.5}deg) scale(1.05);
                            filter: brightness(1.2);
                        }
                        100% {
                            transform: rotateY(${flipAnimation.rotations}deg) rotateX(0deg) rotateZ(0deg) scale(1);
                            filter: brightness(1);
                        }
                    }
                    
                    @keyframes coinShadow {
                        0%, 100% {
                            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5),
                                        0 0 50px rgba(255, 215, 0, 0.15),
                                        inset 0 0 20px rgba(255, 255, 255, 0.05);
                        }
                        50% {
                            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7),
                                        0 0 80px rgba(255, 215, 0, 0.3),
                                        inset 0 0 40px rgba(255, 255, 255, 0.1);
                        }
                    }
                    
                    @keyframes fadeInScale {
                        0% { opacity: 0; transform: scale(0.8); }
                        100% { opacity: 1; transform: scale(1); }
                    }

                    @keyframes subtlePulse {
                        0%, 100% { opacity: 0.5; }
                        50% { opacity: 1; }
                    }
                    
                    .coin-3d {
                        transform-style: preserve-3d;
                        backface-visibility: hidden;
                        animation: coinFlip3D ${flipAnimation ? flipAnimation.duration : 3}s cubic-bezier(0.4, 0.0, 0.2, 1) forwards,
                                   coinShadow ${flipAnimation ? flipAnimation.duration : 3}s ease-in-out infinite;
                    }
                `}
            </style>

            {/* Title */}
            <div style={{ position: 'relative', zIndex: 1, marginBottom: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '600', letterSpacing: '6px', color: '#ffd700', marginBottom: '8px', fontFamily: "'Rajdhani', sans-serif" }}>🪙 COIN TOSS</div>
                <div style={{ width: '40px', height: '2px', background: 'linear-gradient(90deg, transparent, #ffd700, transparent)', margin: '0 auto' }} />
            </div>

            {gameState.coinFlip.status === 'waiting_call' && (
                <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, animation: 'fadeIn 0.5s ease' }}>
                    <h2 style={{ color: '#888', marginBottom: '28px', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.9rem', letterSpacing: '4px', fontWeight: '600' }}>
                        {isCaller ? "CALL THE TOSS" : <span>WAITING FOR <span style={{ color: '#00d4ff' }}>{gameState.teamA}</span>...</span>}
                    </h2>
                    {isCaller && (
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button onClick={() => onCall('heads')} style={{ padding: '18px 48px', fontSize: '1.1rem', background: 'rgba(255, 215, 0, 0.06)', border: '1px solid rgba(255, 215, 0, 0.25)', color: '#ffd700', borderRadius: '12px', cursor: 'pointer', fontWeight: '800', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '3px', transition: 'all 0.3s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 215, 0, 0.12)'; e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.5)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 215, 0, 0.06)'; e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.25)'; }}>
                                HEADS
                            </button>
                            <button onClick={() => onCall('tails')} style={{ padding: '18px 48px', fontSize: '1.1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', borderRadius: '12px', cursor: 'pointer', fontWeight: '800', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '3px', transition: 'all 0.3s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                                TAILS
                            </button>
                        </div>
                    )}
                </div>
            )}

            {(isFlipping || showResult) && (
                <div style={{
                    perspective: '2000px',
                    perspectiveOrigin: 'center center',
                    marginBottom: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <div
                        className={isFlipping ? 'coin-3d' : ''}
                        style={{
                            width: '140px',
                            height: '140px',
                            borderRadius: '50%',
                            border: '3px solid rgba(255, 255, 255, 0.15)',
                            background: gameState.coinFlip.result === 'heads'
                                ? 'radial-gradient(circle at 30% 30%, #ffd700 0%, #b8860b 70%, #8b6914 100%)'
                                : 'radial-gradient(circle at 30% 30%, #94a3b8 0%, #64748b 70%, #475569 100%)',
                            marginBottom: '20px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontSize: '3.5rem',
                            fontWeight: '900',
                            color: '#fff',
                            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                            fontFamily: "'Rajdhani', sans-serif",
                            position: 'relative',
                            overflow: 'hidden',
                            transition: isFlipping ? 'none' : 'all 0.5s ease'
                        }}
                    >
                        <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 70% 70%, rgba(0,0,0,0.3) 0%, transparent 60%)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)', pointerEvents: 'none' }} />
                        <span style={{ position: 'relative', zIndex: 1, transform: isFlipping ? 'scale(0.8)' : 'scale(1)', transition: 'transform 0.3s ease' }}>
                            {isFlipping ? '?' : (gameState.coinFlip.result === 'heads' ? 'H' : 'T')}
                        </span>
                    </div>

                    {!isFlipping && (
                        <div style={{
                            padding: '8px 32px',
                            borderRadius: '8px',
                            fontSize: '1.2rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            fontFamily: "'Rajdhani', sans-serif",
                            letterSpacing: '4px',
                            color: gameState.coinFlip.result === 'heads' ? '#ffd700' : '#94a3b8',
                            background: gameState.coinFlip.result === 'heads' ? 'rgba(255, 215, 0, 0.08)' : 'rgba(148, 163, 184, 0.08)',
                            border: `1px solid ${gameState.coinFlip.result === 'heads' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(148, 163, 184, 0.2)'}`,
                            animation: 'fadeInScale 0.5s ease-out'
                        }}>
                            {gameState.coinFlip.result}
                        </div>
                    )}
                </div>
            )}

            {showResult && gameState.coinFlip.status === 'deciding' && (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.6s ease', position: 'relative', zIndex: 1 }}>
                    <div style={{ marginBottom: '8px' }}>
                        <span style={{ color: gameState.coinFlip.winner === 'A' ? '#00d4ff' : '#ff0055', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '3px', fontFamily: "'Rajdhani', sans-serif" }}>
                            {gameState.coinFlip.winner === 'A' ? gameState.teamA : gameState.teamB}
                        </span>
                        <span style={{ color: '#00ff88', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '3px', fontFamily: "'Rajdhani', sans-serif" }}> WON!</span>
                    </div>
                    <div style={{ color: '#555', marginBottom: '28px', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', letterSpacing: '3px', fontWeight: '600' }}>
                        {isWinner ? "CHOOSE WHO BANS FIRST" : "WAITING FOR DECISION..."}
                    </div>
                    {isWinner && (
                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                            <button onClick={() => onDecide('first')} style={{ padding: '14px 36px', background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.25)', color: '#00d4ff', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.9rem', letterSpacing: '2px', transition: 'all 0.3s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)'; }}>
                                WE START
                            </button>
                            <button onClick={() => onDecide('second')} style={{ padding: '14px 36px', background: 'rgba(255, 0, 85, 0.08)', border: '1px solid rgba(255, 0, 85, 0.25)', color: '#ff0055', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.9rem', letterSpacing: '2px', transition: 'all 0.3s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 0, 85, 0.15)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 0, 85, 0.08)'; }}>
                                THEY START
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function App() {
    const [params] = useState(getParams());
    const [gameState, setGameState] = useState(null);
    const [myRole, setMyRole] = useState(null);
    const [view, setView] = useState('home');
    const [historyData, setHistoryData] = useState([]);

    // --- PAGINATION STATE ---
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [showNotification, setShowNotification] = useState(false);
    const [hoveredItem, setHoveredItem] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showRules, setShowRules] = useState(false);
    const rulesShownRef = useRef(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [inputError, setInputError] = useState(false);

    const isAdminRoute = window.location.pathname === '/admin';
    // JWT Auth State
    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
    const [currentUser, setCurrentUser] = useState(null);
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
    const [adminLoginError, setAdminLoginError] = useState('');
    const [adminLoginLoading, setAdminLoginLoading] = useState(false);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    // Password change modal
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    // User management (super_admin only)
    const [showUserManagement, setShowUserManagement] = useState(false);
    const [userList, setUserList] = useState([]);
    const [newUserUsername, setNewUserUsername] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState('admin');
    const [newUserPermissions, setNewUserPermissions] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [userError, setUserError] = useState('');
    const [allPermissions, setAllPermissions] = useState([]);

    const [adminTeamA, setAdminTeamA] = useState('');
    const [adminTeamB, setAdminTeamB] = useState('');
    const [adminLinks, setAdminLinks] = useState(null);
    const [mapPool, setMapPool] = useState([]);
    const [newMapName, setNewMapName] = useState('');
    const [newMapImage, setNewMapImage] = useState('');

    const [teamA, setTeamA] = useState('');
    const [teamB, setTeamB] = useState('');
    const [teamALogo, setTeamALogo] = useState('');
    const [teamBLogo, setTeamBLogo] = useState('');

    const [createdLinks, setCreatedLinks] = useState(null);
    const [availableMaps, setAvailableMaps] = useState([]);
    const [customSelectedMaps, setCustomSelectedMaps] = useState([]);
    const [customSequence, setCustomSequence] = useState([]);
    const [userCustomMap, setUserCustomMap] = useState('');
    const [useTimer, setUseTimer] = useState(false);
    const [timerDuration, setTimerDuration] = useState(60); // Default 60 seconds
    const [useCoinFlip, setUseCoinFlip] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false'); // Default enabled
    const [userCount, setUserCount] = useState(0); // Track total connected users

    const prevLogsRef = useRef([]); // Track previous logs to detect new actions 

    const [vetoMode, setVetoMode] = useState('vrs');

    // Discord Webhook States
    const [adminWebhook, setAdminWebhook] = useState('');
    const [tempWebhook, setTempWebhook] = useState('');
    const [webhookTestStatus, setWebhookTestStatus] = useState(null);

    const fileInputA = useRef(null);
    const fileInputB = useRef(null);

    // Helper: get auth headers for API calls
    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
    }, []);

    // Helper: check if user has permission
    const hasPermission = useCallback((permission) => {
        if (!currentUser) return false;
        if (currentUser.role === 'super_admin') return true;
        return currentUser.permissions && currentUser.permissions.includes(permission);
    }, [currentUser]);

    const fetchAdminHistory = useCallback((token) => {
        setAdminLoginLoading(true);
        setAdminLoginError('');
        fetch(`${SOCKET_URL}/api/admin/history`, { method: "POST", headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('currentUser');
                    setIsAdminAuthenticated(false);
                    setCurrentUser(null);
                    setAuthToken('');
                    setAdminLoginLoading(false);
                    setAdminLoginError('Session expired. Please login again.');
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (!data) return;
                setAdminLoginLoading(false);
                if (data.error) {
                    if (isAdminRoute) { setAdminLoginError(data.error); }
                    else { alert(data.error); }
                }
                else { setHistoryData(data); setIsAdminAuthenticated(true); setAdminLoginError(''); }
            })
            .catch(() => {
                setAdminLoginLoading(false);
                setAdminLoginError('Connection failed. Is the server running?');
            });
    }, [isAdminRoute]);

    const fetchMapPool = useCallback((token) => {
        fetch(`${SOCKET_URL}/api/admin/maps/get`, { method: "POST", headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } })
            .then(r => r.json()).then(data => { if (Array.isArray(data)) setMapPool(data); });
    }, []);

    // Fetch users list (super_admin only)
    const fetchUsers = useCallback((token) => {
        fetch(`${SOCKET_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json()).then(data => { if (Array.isArray(data)) setUserList(data); });
    }, []);

    // Fetch permissions list
    const fetchPermissions = useCallback((token) => {
        fetch(`${SOCKET_URL}/api/admin/permissions`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json()).then(data => { if (Array.isArray(data)) setAllPermissions(data); });
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        const link = document.createElement('link'); link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap'; link.rel = 'stylesheet'; document.head.appendChild(link);
        document.title = "LOTGaming | CS2 Veto";

        fetch(`${SOCKET_URL}/api/maps`)
            .then(r => {
                if (!r.ok) throw new Error("Server Error");
                return r.json();
            })
            .then(data => {
                setAvailableMaps(data);
                setCustomSelectedMaps(data.map(m => m.name));
            })
            .catch(() => { });

        if (isAdminRoute) {
            const savedToken = localStorage.getItem('authToken');
            const savedUser = localStorage.getItem('currentUser');
            if (savedToken && savedUser) {
                try {
                    const user = JSON.parse(savedUser);
                    setAuthToken(savedToken);
                    setCurrentUser(user);
                    fetchAdminHistory(savedToken);
                    fetchMapPool(savedToken);
                    // Load admin webhook
                    fetch(`${SOCKET_URL}/api/admin/webhook/get`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${savedToken}` }
                    })
                        .then(r => r.json())
                        .then(data => {
                            if (data.webhookUrl) setAdminWebhook(data.webhookUrl);
                        })
                        .catch(() => { });
                    if (user.role === 'super_admin') {
                        fetchUsers(savedToken);
                        fetchPermissions(savedToken);
                    }
                } catch (e) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('currentUser');
                }
            }
        }

        // Listen for total user count updates (works on all pages)
        socket.on('user_count', (count) => {
            setUserCount(count);
        });


        if (params.room && !isAdminRoute) {
            socket.emit('join_room', { roomId: params.room, key: params.key });
            socket.on('update_state', (data) => {
                // Detect new actions by comparing logs
                if (data && data.logs && prevLogsRef.current.length > 0 && soundEnabled) {
                    const newLogs = data.logs.slice(prevLogsRef.current.length);
                    newLogs.forEach(log => {
                        if (log.includes('[BAN]')) playSound('ban');
                        else if (log.includes('[PICK]')) playSound('pick');
                        else if (log.includes('[SIDE]') || (log.includes('chose') && log.includes('side'))) playSound('side');
                        else if (log.includes('[READY]')) playSound('ready');
                        else if (log.includes('[COIN]')) playSound('coin');
                        else if (log.includes('[AUTO-BAN]') || log.includes('[AUTO-PICK]') || log.includes('[AUTO-SIDE]')) {
                            // Play sound for auto actions too
                            if (log.includes('AUTO-BAN')) playSound('ban');
                            else if (log.includes('AUTO-PICK')) playSound('pick');
                            else if (log.includes('AUTO-SIDE')) playSound('side');
                        }
                    });
                }
                if (data && data.logs) prevLogsRef.current = [...data.logs];
                setGameState(data);
                if (data && !data.finished && !rulesShownRef.current) { setShowRules(true); rulesShownRef.current = true; }
            });
            socket.on('role_assigned', (role) => setMyRole(role));
        }

        socket.on('match_created', ({ roomId, keys }) => {
            const links = {
                admin: `${window.location.origin}/?room=${roomId}&key=${keys.admin}`,
                teamA: `${window.location.origin}/?room=${roomId}&key=${keys.A}`,
                teamB: `${window.location.origin}/?room=${roomId}&key=${keys.B}`
            };

            if (isAdminRoute) {
                setAdminLinks(links);
                const token = localStorage.getItem('authToken');
                if (token) fetchAdminHistory(token);
            } else {
                setTimeout(() => { setIsGenerating(false); setCreatedLinks(links); }, 800);
            }
        });

        return () => { socket.off('update_state'); socket.off('role_assigned'); window.removeEventListener('resize', handleResize); };
    }, [params.room, params.key, isAdminRoute, fetchAdminHistory, fetchMapPool, fetchUsers, fetchPermissions, soundEnabled]);

    const handleLogoUpload = (e, team) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2000000) return alert("File too large. Max 2MB.");
            const reader = new FileReader();
            reader.onloadend = () => {
                if (team === 'A') setTeamALogo(reader.result);
                else setTeamBLogo(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const createMatch = (type, isFromAdmin = false) => {
        const tA = isFromAdmin ? adminTeamA : teamA;
        const tB = isFromAdmin ? adminTeamB : teamB;
        const logoA = isFromAdmin ? '' : teamALogo;
        const logoB = isFromAdmin ? '' : teamBLogo;

        if (!tA.trim() || !tB.trim()) { setInputError(true); return; }

        let format = type;
        if (vetoMode === 'faceit') {
            if (type === 'bo1') format = 'faceit_bo1';
            if (type === 'bo3') format = 'faceit_bo3';
            if (type === 'bo5') format = 'faceit_bo5';
        } else if (vetoMode === 'wingman') {
            if (type === 'bo1') format = 'wingman_bo1';
            if (type === 'bo3') format = 'wingman_bo3';
        } else if (vetoMode === 'custom') {
            format = 'custom';
        }

        if (format === 'custom') {
            if (customSelectedMaps.length === 0) return alert("Please select at least one map.");
            if (customSequence.length === 0) return alert("Please define at least one step in the sequence.");
        }

        if (!isFromAdmin) setIsGenerating(true);
        const durationToSend = useTimer ? timerDuration : 60;
        console.log('[CLIENT] Creating match - useTimer:', useTimer, 'timerDuration:', timerDuration, 'sending:', durationToSend);
        socket.emit('create_match', {
            teamA: tA, teamB: tB,
            teamALogo: logoA, teamBLogo: logoB,
            format,
            customMapNames: format === 'custom' ? customSelectedMaps : null,
            customSequence: format === 'custom' ? customSequence : null,
            useTimer,
            useCoinFlip,
            timerDuration: useTimer ? parseInt(timerDuration) : 60,
            tempWebhookUrl: tempWebhook.trim()
        });
        setTeamA(''); setTeamB(''); setTeamALogo(''); setTeamBLogo('');
        setUseCoinFlip(false);
        setTempWebhook(''); // Clear temp webhook after match creation
    };

    const handleAction = (data) => {
        if (!gameState || gameState.finished) return;
        // Play sound immediately on user action (before server confirms)
        if (soundEnabled) {
            const currentStep = gameState.sequence[gameState.step];
            if (currentStep) {
                if (currentStep.a === 'ban') playSound('ban');
                else if (currentStep.a === 'pick') playSound('pick');
                else if (currentStep.a === 'side') playSound('side');
            }
        }
        socket.emit('action', { roomId: params.room, data, key: params.key });
    };

    const handleReady = () => {
        if (soundEnabled) playSound('ready');
        socket.emit('team_ready', { roomId: params.room, key: params.key });
    };

    // --- COIN HANDLERS ---
    const handleCoinCall = (call) => {
        if (soundEnabled) playSound('coin');
        socket.emit('coin_call', { roomId: params.room, call, key: params.key });
    };

    const handleCoinDecide = (decision) => {
        if (soundEnabled) playSound('coin');
        socket.emit('coin_decision', { roomId: params.room, decision, key: params.key });
    };

    const fetchPublicHistory = (page = 1) => {
        fetch(`${SOCKET_URL}/api/history?page=${page}&limit=10`)
            .then(res => {
                if (!res.ok) throw new Error("Server Error");
                return res.json();
            })
            .then(data => {
                setHistoryData(data.matches);
                setTotalPages(data.totalPages);
                setCurrentPage(data.currentPage);
                setView('history');
            })
            .catch(err => console.error("Error fetching history:", err));
    };

    const handlePageChange = (newPage) => {
        if (newPage > 0 && newPage <= totalPages) {
            fetchPublicHistory(newPage);
        }
    };

    const updateMapPool = (newMaps) => { const token = localStorage.getItem('authToken'); fetch(`${SOCKET_URL}/api/admin/maps/update`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ maps: newMaps }) }).then(r => r.json()).then(data => { if (data.success) setMapPool(data.maps); }); };
    const handleAddMap = () => { if (!newMapName.trim()) return; const newMap = { name: newMapName.trim(), customImage: newMapImage.trim() || null }; updateMapPool([...mapPool, newMap]); setNewMapName(''); setNewMapImage(''); };
    const handleDeleteMap = (idx) => { if (!window.confirm("Remove map?")) return; const updated = [...mapPool]; updated.splice(idx, 1); updateMapPool(updated); };
    const deleteMatch = (id) => { if (!window.confirm("DELETE?")) return; const token = localStorage.getItem('authToken'); fetch(`${SOCKET_URL}/api/admin/delete`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ id }) }).then(res => res.json()).then(data => { if (data.success) fetchAdminHistory(token); }); };
    const nukeHistory = () => { if (!window.confirm("DELETE ALL?")) return; const token = localStorage.getItem('authToken'); fetch(`${SOCKET_URL}/api/admin/reset`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } }).then(res => res.json()).then(data => { if (data.success) fetchAdminHistory(token); }); };

    // --- ADMIN ACTIONS ---
    const handleAdminReset = (roomId) => {
        if (!window.confirm("Reset this match completely?")) return;
        const token = localStorage.getItem('authToken');
        socket.emit('admin_reset_match', { roomId, token });
    };

    const handleAdminUndo = (roomId) => {
        const token = localStorage.getItem('authToken');
        socket.emit('admin_undo_step', { roomId, token });
    };

    const handleCopyLogs = (text) => { navigator.clipboard.writeText(text).then(() => { setShowNotification(true); setTimeout(() => setShowNotification(false), 3000); }); };
    const copyLink = (roomId, key) => { handleCopyLogs(`${window.location.origin}/?room=${roomId}&key=${key}`); };
    const goHome = () => window.location.href = "/";

    const toggleMapSelection = (mapName) => {
        if (customSelectedMaps.includes(mapName)) setCustomSelectedMaps(customSelectedMaps.filter(m => m !== mapName));
        else setCustomSelectedMaps([...customSelectedMaps, mapName]);
    };

    const addUserMap = () => {
        if (!userCustomMap.trim()) return;
        const newName = userCustomMap.trim();
        setAvailableMaps([...availableMaps, { name: newName }]);
        setCustomSelectedMaps([...customSelectedMaps, newName]);
        setUserCustomMap('');
    };

    const addSequenceStep = (team, action) => setCustomSequence([...customSequence, { t: team, a: action }]);
    const removeSequenceStep = (idx) => { const s = [...customSequence]; s.splice(idx, 1); setCustomSequence(s); };

    const getInstruction = () => {
        if (!gameState || gameState.finished) return "VETO COMPLETED, CHECK DISCORD MATCHROOM FOR THE SERVER IP";
        if (!gameState.sequence || !gameState.sequence[gameState.step]) return "VETO COMPLETED";
        const currentStep = gameState.sequence[gameState.step];
        const teamName = currentStep.t === 'A' ? gameState.teamA : gameState.teamB;
        const isMe = currentStep.t === myRole;

        if (gameState.useTimer && gameState.ready) {
            if (!gameState.ready.A || !gameState.ready.B) {
                if (isMe && !gameState.ready[myRole]) return "PLEASE CLICK READY TO START";
                return "WAITING FOR TEAMS TO READY UP";
            }
        }

        if (currentStep.a === 'side') return isMe ? "CHOOSE STARTING SIDE" : `${teamName.toUpperCase()} IS CHOOSING SIDE`;
        let count = 0;
        for (let i = gameState.step; i < gameState.sequence.length; i++) { if (gameState.sequence[i].t === currentStep.t && gameState.sequence[i].a === currentStep.a) count++; else break; }
        const actionText = currentStep.a === 'ban' ? 'BAN' : 'PICK';
        return isMe ? `YOUR TURN: ${actionText} ${count} MAP${count > 1 ? 'S' : ''}` : `WAITING FOR ${teamName.toUpperCase()}`;
    };

    // --- NEW HELPER FOR ROLE BADGE ---
    const getRoleLabel = () => {
        if (myRole === 'admin') return { text: 'ADMIN VIEW', color: '#ffd700' };
        if (myRole === 'A') return { text: `${gameState.teamA} VIEW`, color: '#00d4ff' };
        if (myRole === 'B') return { text: `${gameState.teamB} VIEW`, color: '#ff0055' };
        return { text: 'SPECTATOR VIEW', color: '#888' };
    };

    const getMapLogData = (mapName) => {
        if (!gameState || !gameState.logs) return null;
        const banLog = gameState.logs.find(l => l.includes(`banned ${mapName}`));
        if (banLog) return { type: 'ban', team: banLog.split(' banned ')[0].replace('[BAN] ', '').trim() };
        const pickLog = gameState.logs.find(l => l.includes(`picked ${mapName}`));
        if (pickLog) {
            const teamName = pickLog.split(' picked ')[0].replace('[PICK] ', '').trim();
            let sideText = "WAITING FOR SIDE";

            // First check if side is in the pickLog itself (inline format)
            const inlineMatch = pickLog.match(/\((.*?) chose (CT|T) side for/);
            if (inlineMatch) {
                sideText = `${inlineMatch[1]} CHOSE ${inlineMatch[2]}`;
            } else {
                // Check for separate side log
                const sideLog = gameState.logs.find(l => l.includes(`side for ${mapName}`));
                if (sideLog) {
                    const match = sideLog.match(/(?:\[SIDE\]|\() (.*?) chose (CT|T) side/);
                    if (match) sideText = `${match[1]} CHOSE ${match[2]}`;
                }
            }

            // Also check the map.side property as final fallback
            const mapObj = gameState.maps.find(m => m.name === mapName);
            if (mapObj && mapObj.side && sideText === "WAITING FOR SIDE") {
                const sideChooser = mapObj.pickedBy === 'A' ? gameState.teamA : gameState.teamB;
                sideText = `${sideChooser} CHOSE ${mapObj.side}`;
            }

            return { type: 'pick', team: teamName, sideText };
        }
        if (gameState.logs.find(l => l.includes(`[DECIDER] ${mapName} (Knife`))) return { type: 'decider', sideText: 'SIDE VIA KNIFE' };
        const sideLog = gameState.logs.find(l => l.includes(`side for ${mapName}`));
        if (sideLog) {
            const match = sideLog.match(/(?:\[SIDE\]|\() (.*?) chose (.*?) side/);
            if (match) return { type: 'decider', sideText: `${match[1]} CHOSE ${match[2]}` };
        }
        return null;
    };

    const styles = getStyles(isMobile);

    // --- RENDER ADMIN ---
    if (isAdminRoute) {
        const activeCount = historyData.filter(m => !m.finished).length;

        const handleAdminLogin = () => {
            if (!loginUsername.trim() || !loginPassword.trim()) {
                setAdminLoginError('Please enter username and password');
                return;
            }
            setAdminLoginLoading(true);
            setAdminLoginError('');
            fetch(`${SOCKET_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loginUsername, password: loginPassword })
            })
                .then(res => res.json())
                .then(data => {
                    setAdminLoginLoading(false);
                    if (data.error) {
                        setAdminLoginError(data.error);
                    } else if (data.token) {
                        localStorage.setItem('authToken', data.token);
                        localStorage.setItem('currentUser', JSON.stringify(data.user));
                        setAuthToken(data.token);
                        setCurrentUser(data.user);
                        setIsAdminAuthenticated(true);
                        setAdminLoginError('');

                        // Check if must change password
                        if (data.user.must_change_password) {
                            setShowPasswordChange(true);
                        }

                        // Fetch admin data
                        fetchAdminHistory(data.token);
                        fetchMapPool(data.token);

                        // Load webhook
                        fetch(`${SOCKET_URL}/api/admin/webhook/get`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` }
                        }).then(r => r.json()).then(d => { if (d.webhookUrl) setAdminWebhook(d.webhookUrl); }).catch(() => {});

                        // If super_admin, fetch users
                        if (data.user.role === 'super_admin') {
                            fetchUsers(data.token);
                            fetchPermissions(data.token);
                        }
                    }
                })
                .catch(() => {
                    setAdminLoginLoading(false);
                    setAdminLoginError('Connection failed. Is the server running?');
                });
        };

        // Password change handler
        const handleChangePassword = () => {
            setPasswordError('');
            setPasswordSuccess('');
            if (!newPassword || newPassword.length < 4) {
                setPasswordError('Password must be at least 4 characters');
                return;
            }
            if (newPassword !== confirmPassword) {
                setPasswordError('Passwords do not match');
                return;
            }
            const token = localStorage.getItem('authToken');
            fetch(`${SOCKET_URL}/api/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ currentPassword, newPassword })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.error) {
                        setPasswordError(data.error);
                    } else {
                        setPasswordSuccess('Password changed successfully!');
                        if (data.token) {
                            localStorage.setItem('authToken', data.token);
                            setAuthToken(data.token);
                        }
                        // Update user to remove must_change_password
                        const updatedUser = { ...currentUser, must_change_password: false };
                        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                        setCurrentUser(updatedUser);
                        setTimeout(() => {
                            setShowPasswordChange(false);
                            setPasswordSuccess('');
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                        }, 1500);
                    }
                })
                .catch(() => setPasswordError('Network error'));
        };

        // User management handlers
        const handleCreateUser = () => {
            setUserError('');
            if (!newUserUsername.trim() || !newUserPassword.trim()) {
                setUserError('Username and password required');
                return;
            }
            const token = localStorage.getItem('authToken');
            fetch(`${SOCKET_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ username: newUserUsername, password: newUserPassword, role: newUserRole, permissions: newUserPermissions })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.error) { setUserError(data.error); }
                    else { setNewUserUsername(''); setNewUserPassword(''); setNewUserRole('admin'); setNewUserPermissions([]); fetchUsers(token); }
                })
                .catch(() => setUserError('Network error'));
        };

        const handleUpdateUserPermissions = (userId, permissions) => {
            const token = localStorage.getItem('authToken');
            fetch(`${SOCKET_URL}/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ permissions })
            })
                .then(r => r.json())
                .then(data => { if (data.success) fetchUsers(token); })
                .catch(() => {});
        };

        const handleUpdateUserRole = (userId, role) => {
            const token = localStorage.getItem('authToken');
            fetch(`${SOCKET_URL}/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ role })
            })
                .then(r => r.json())
                .then(data => { if (data.success) fetchUsers(token); })
                .catch(() => {});
        };

        const handleDeleteUser = (userId) => {
            if (!window.confirm('Delete this user?')) return;
            const token = localStorage.getItem('authToken');
            fetch(`${SOCKET_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(r => r.json())
                .then(data => { if (data.success) fetchUsers(token); })
                .catch(() => {});
        };

        const handleResetUserPassword = (userId) => {
            const pwd = window.prompt('Enter new password (min 4 chars):');
            if (!pwd || pwd.length < 4) { alert('Password must be at least 4 characters'); return; }
            const token = localStorage.getItem('authToken');
            fetch(`${SOCKET_URL}/api/admin/users/${userId}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ newPassword: pwd })
            })
                .then(r => r.json())
                .then(data => { if (data.success) alert('Password reset. User will be prompted to change on next login.'); })
                .catch(() => {});
        };

        // --- ADMIN LOGIN PAGE ---
        if (!isAdminAuthenticated) {
            return (
                <div style={{ minHeight: '100vh', background: '#05070a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rajdhani', sans-serif", position: 'relative', overflow: 'hidden' }}>
                    {/* Ambient glow */}
                    <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(0, 212, 255, 0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

                    {/* Top bar */}
                    <div className="admin-topbar">
                        <button onClick={goHome} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#888', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem', letterSpacing: '1px', transition: 'all 0.2s' }}>
                            ← HOME
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00ff00', fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.7 }}>
                                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00ff00', boxShadow: '0 0 8px #00ff00', animation: 'pulse 2s infinite' }} />
                                <span>{userCount} online</span>
                            </div>
                        </div>
                    </div>

                    {/* Login card */}
                    <div style={{ width: '100%', maxWidth: '420px', padding: '0 20px', animation: 'fadeIn 0.5s ease-out', zIndex: 1 }}>
                        {/* Logo / Icon */}
                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                            <div style={{ width: '64px', height: '64px', margin: '0 auto 24px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 212, 255, 0.05))', border: '1px solid rgba(0, 212, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'glowPulse 3s infinite' }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: '700', letterSpacing: '6px', background: 'linear-gradient(to right, #00d4ff, #ff0055)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 8px' }}>CONTROL PANEL</h1>
                            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', letterSpacing: '3px', margin: 0 }}>ADMIN ACCESS REQUIRED</p>
                        </div>

                        {/* Form */}
                        <form onSubmit={(e) => { e.preventDefault(); handleAdminLogin(); }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' }}>Username</label>
                                <input
                                    type="text"
                                    className={`admin-login-input ${adminLoginError ? 'error' : ''}`}
                                    value={loginUsername}
                                    onChange={e => { setLoginUsername(e.target.value); setAdminLoginError(''); }}
                                    placeholder="Enter username"
                                    autoFocus
                                    autoComplete="username"
                                />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' }}>Password</label>
                                <input
                                    type="password"
                                    className={`admin-login-input ${adminLoginError ? 'error' : ''}`}
                                    value={loginPassword}
                                    onChange={e => { setLoginPassword(e.target.value); setAdminLoginError(''); }}
                                    placeholder="••••••••••••"
                                    autoComplete="current-password"
                                />
                            </div>

                            {/* Error message */}
                            {adminLoginError && (
                                <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255, 68, 68, 0.08)', border: '1px solid rgba(255, 68, 68, 0.2)', color: '#ff6666', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.3s ease' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    {adminLoginError}
                                </div>
                            )}

                            <button type="submit" className="admin-login-btn" disabled={adminLoginLoading}>
                                {adminLoginLoading ? (
                                    <>
                                        <div style={{ width: '18px', height: '18px', border: '2px solid rgba(0, 212, 255, 0.3)', borderTop: '2px solid #00d4ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                        AUTHENTICATING
                                    </>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                                        SIGN IN
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer hint */}
                        <div style={{ textAlign: 'center', marginTop: '32px', color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', letterSpacing: '1px' }}>
                            Default: admin / admin123
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ position: 'absolute', bottom: '20px', color: 'rgba(255,255,255,0.08)', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: '500' }}>LOTGaming System | kancha@lotgaming.xyz</div>
                </div>
            );
        }

        // --- AUTHENTICATED ADMIN DASHBOARD ---
        return (
            <div style={{ minHeight: '100vh', background: '#05070a', fontFamily: "'Rajdhani', sans-serif", color: '#fff' }}>
                {/* Top navigation bar */}
                <div className="admin-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={goHome} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#888', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', letterSpacing: '1px', transition: 'all 0.2s' }}>
                            ← HOME
                        </button>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: '700', letterSpacing: '4px', background: 'linear-gradient(to right, #00d4ff, #ff0055)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>CONTROL PANEL</h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00ff00', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00ff00', boxShadow: '0 0 8px #00ff00', animation: 'pulse 2s infinite' }} />
                            <span>{userCount} online</span>
                        </div>
                        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                        {currentUser && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#aaa', fontSize: '0.8rem', letterSpacing: '1px' }}>
                                    {currentUser.username}
                                </span>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '1px',
                                    background: currentUser.role === 'super_admin' ? 'rgba(255, 0, 85, 0.15)' : 'rgba(0, 212, 255, 0.15)',
                                    color: currentUser.role === 'super_admin' ? '#ff0055' : '#00d4ff',
                                    border: `1px solid ${currentUser.role === 'super_admin' ? 'rgba(255, 0, 85, 0.3)' : 'rgba(0, 212, 255, 0.3)'}`
                                }}>
                                    {currentUser.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
                                </span>
                            </div>
                        )}
                        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                        <button
                            onClick={() => { setShowPasswordChange(true); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordSuccess(''); }}
                            style={{ background: 'transparent', border: '1px solid rgba(0, 212, 255, 0.2)', color: '#00d4ff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', letterSpacing: '1px', transition: 'all 0.2s' }}
                            title="Change Password"
                        >
                            🔑
                        </button>
                        {currentUser && currentUser.role === 'super_admin' && (
                            <button
                                onClick={() => { setShowUserManagement(true); fetchUsers(); fetchPermissions(); }}
                                style={{ background: 'transparent', border: '1px solid rgba(255, 165, 0, 0.2)', color: '#ffa500', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', letterSpacing: '1px', transition: 'all 0.2s' }}
                                title="User Management"
                            >
                                👥
                            </button>
                        )}
                        <button
                            onClick={() => { localStorage.removeItem('authToken'); localStorage.removeItem('currentUser'); setIsAdminAuthenticated(false); setCurrentUser(null); setAuthToken(''); }}
                            style={{ background: 'transparent', border: '1px solid rgba(255, 68, 68, 0.2)', color: '#ff6666', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', letterSpacing: '1px', transition: 'all 0.2s' }}
                        >
                            LOGOUT
                        </button>
                    </div>
                </div>

                {/* Main content with top padding for fixed navbar */}
                <div style={{ paddingTop: '76px', paddingBottom: '40px', paddingLeft: isMobile ? '12px' : '24px', paddingRight: isMobile ? '12px' : '24px', maxWidth: '1400px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>

                        {/* LEFT COLUMN */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: isMobile ? 'auto' : '360px' }}>

                            {/* QUICK CREATE */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <div className="admin-section-icon" style={{ background: 'rgba(0, 212, 255, 0.1)' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    </div>
                                    <h3>QUICK CREATE</h3>
                                </div>

                                <input className="admin-input" value={adminTeamA} onChange={e => setAdminTeamA(e.target.value)} placeholder="Team A Name" />
                                <input className="admin-input" value={adminTeamB} onChange={e => setAdminTeamB(e.target.value)} placeholder="Team B Name" />

                                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label className="admin-checkbox">
                                        <input type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)} />
                                        <span>Auto-Ban Timer</span>
                                    </label>
                                    {useTimer && (
                                        <div style={{ display: 'flex', gap: '4px', padding: '4px 0 4px 38px', flexWrap: 'wrap' }}>
                                            {[30, 45, 60, 90, 120].map(seconds => (
                                                <button
                                                    key={seconds}
                                                    onClick={() => setTimerDuration(seconds)}
                                                    style={{
                                                        padding: '4px 12px',
                                                        background: timerDuration === seconds ? '#00d4ff' : 'transparent',
                                                        color: timerDuration === seconds ? '#000' : '#666',
                                                        border: `1px solid ${timerDuration === seconds ? '#00d4ff' : 'rgba(255,255,255,0.08)'}`,
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontFamily: "'Rajdhani', sans-serif",
                                                        fontWeight: 'bold',
                                                        fontSize: '0.8rem',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {seconds}s
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <label className="admin-checkbox gold">
                                        <input type="checkbox" checked={useCoinFlip} onChange={e => setUseCoinFlip(e.target.checked)} />
                                        <span>Coin Flip</span>
                                    </label>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                    <button className="create-mode-btn bo1" onClick={() => createMatch('bo1', true)}>Bo1</button>
                                    <button className="create-mode-btn bo3" onClick={() => createMatch('bo3', true)}>Bo3</button>
                                    <button className="create-mode-btn bo5" onClick={() => createMatch('bo5', true)}>Bo5</button>
                                </div>

                                {adminLinks && (
                                    <div className="generated-links">
                                        <div style={{ color: '#00d4ff', fontSize: '0.75rem', letterSpacing: '2px', marginBottom: '10px', fontWeight: 700 }}>✓ LINKS GENERATED</div>
                                        <div className="generated-link-row" onClick={() => handleCopyLogs(adminLinks.admin)}>
                                            <span className="generated-link-label" style={{ color: '#ffd700' }}>ADMIN</span>
                                            <span className="generated-link-url">{adminLinks.admin}</span>
                                        </div>
                                        <div className="generated-link-row" onClick={() => handleCopyLogs(adminLinks.teamA)}>
                                            <span className="generated-link-label" style={{ color: '#00d4ff' }}>TEAM A</span>
                                            <span className="generated-link-url">{adminLinks.teamA}</span>
                                        </div>
                                        <div className="generated-link-row" onClick={() => handleCopyLogs(adminLinks.teamB)}>
                                            <span className="generated-link-label" style={{ color: '#ff0055' }}>TEAM B</span>
                                            <span className="generated-link-url">{adminLinks.teamB}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* MAP POOL EDITOR */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <div className="admin-section-icon" style={{ background: 'rgba(255, 165, 0, 0.1)' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                                    </div>
                                    <h3>MAP POOL</h3>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                                    {mapPool.map((map, i) => (
                                        <div key={i} className="map-chip">
                                            <span className={`map-name ${map.customImage ? 'custom' : ''}`}>{map.name}</span>
                                            <button onClick={() => handleDeleteMap(i)} className="delete-btn"><TrashIcon /></button>
                                        </div>
                                    ))}
                                </div>
                                <input className="admin-input" value={newMapName} onChange={e => setNewMapName(e.target.value)} placeholder="New Map Name" />
                                <input className="admin-input" value={newMapImage} onChange={e => setNewMapImage(e.target.value)} placeholder="Image URL (Optional)" />
                                <button onClick={handleAddMap} style={{ width: '100%', padding: '10px', background: 'rgba(255, 165, 0, 0.1)', border: '1px solid rgba(255, 165, 0, 0.3)', color: '#ffa500', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '0.9rem', letterSpacing: '2px', marginTop: '4px', transition: 'all 0.2s' }}>
                                    ADD MAP
                                </button>
                            </div>

                            {/* DISCORD WEBHOOK */}
                            <div className="admin-section">
                                <div className="admin-section-header">
                                    <div className="admin-section-icon" style={{ background: 'rgba(114, 137, 218, 0.1)' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7289da" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    </div>
                                    <h3>DISCORD WEBHOOK</h3>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', margin: '0 0 12px', lineHeight: '1.4' }}>
                                    Configure a permanent webhook that fires for ALL matches
                                </p>
                                <input
                                    className="admin-input"
                                    value={adminWebhook}
                                    onChange={e => setAdminWebhook(e.target.value)}
                                    placeholder="https://discord.com/api/webhooks/..."
                                    style={{ fontSize: '0.85rem', fontFamily: "'Consolas', monospace", letterSpacing: 0 }}
                                />
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <button
                                        className="webhook-btn save"
                                        onClick={() => {
                                            fetch(`${SOCKET_URL}/api/admin/webhook/set`, {
                                                method: 'POST',
                                                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ webhookUrl: adminWebhook })
                                            })
                                                .then(r => r.json())
                                                .then(data => {
                                                    if (data.success) {
                                                        setWebhookTestStatus({ success: true, message: 'Webhook saved!' });
                                                        setTimeout(() => setWebhookTestStatus(null), 3000);
                                                    } else {
                                                        setWebhookTestStatus({ success: false, message: data.error || 'Failed to save' });
                                                        setTimeout(() => setWebhookTestStatus(null), 3000);
                                                    }
                                                })
                                                .catch(() => {
                                                    setWebhookTestStatus({ success: false, message: 'Network error' });
                                                    setTimeout(() => setWebhookTestStatus(null), 3000);
                                                });
                                        }}
                                    >
                                        SAVE
                                    </button>
                                    <button
                                        className="webhook-btn test"
                                        onClick={() => {
                                            if (!adminWebhook.trim()) return;
                                            setWebhookTestStatus({ success: null, message: 'Testing...' });
                                            fetch(`${SOCKET_URL}/api/admin/webhook/test`, {
                                                method: 'POST',
                                                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ webhookUrl: adminWebhook })
                                            })
                                                .then(r => r.json())
                                                .then(data => {
                                                    if (data.success) {
                                                        setWebhookTestStatus({ success: true, message: 'Test sent! Check Discord.' });
                                                        setTimeout(() => setWebhookTestStatus(null), 3000);
                                                    } else {
                                                        setWebhookTestStatus({ success: false, message: data.error || 'Test failed' });
                                                        setTimeout(() => setWebhookTestStatus(null), 3000);
                                                    }
                                                })
                                                .catch(() => {
                                                    setWebhookTestStatus({ success: false, message: 'Network error' });
                                                    setTimeout(() => setWebhookTestStatus(null), 3000);
                                                });
                                        }}
                                    >
                                        TEST
                                    </button>
                                    <button
                                        className="webhook-btn clear"
                                        onClick={() => {
                                            setAdminWebhook('');
                                            fetch(`${SOCKET_URL}/api/admin/webhook/set`, {
                                                method: 'POST',
                                                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ webhookUrl: '' })
                                            });
                                        }}
                                    >
                                        CLEAR
                                    </button>
                                </div>
                                {webhookTestStatus && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        background: webhookTestStatus.success === null ? 'rgba(0, 212, 255, 0.08)' : webhookTestStatus.success ? 'rgba(0, 255, 0, 0.08)' : 'rgba(255, 0, 0, 0.08)',
                                        border: `1px solid ${webhookTestStatus.success === null ? 'rgba(0, 212, 255, 0.2)' : webhookTestStatus.success ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)'}`,
                                        color: webhookTestStatus.success === null ? '#00d4ff' : webhookTestStatus.success ? '#00ff00' : '#ff4444',
                                        fontSize: '0.85rem',
                                        textAlign: 'center',
                                        animation: 'fadeIn 0.3s ease'
                                    }}>
                                        {webhookTestStatus.message}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN - HISTORY */}
                        <div style={{ flex: 2 }}>
                            <div className="admin-section" style={{ height: isMobile ? 'auto' : 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div className="admin-section-icon" style={{ background: 'rgba(0, 255, 0, 0.1)' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ff00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"/><circle cx="12" cy="12" r="10"/></svg>
                                        </div>
                                        <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem', letterSpacing: '2px' }}>MATCH HISTORY</h3>
                                        <button
                                            onClick={() => fetchAdminHistory()}
                                            className="admin-action-btn reset"
                                            title="Refresh"
                                        >
                                            <RefreshIcon />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#666' }}>
                                        <span>LIVE <span style={{ color: '#00ff00', fontWeight: 'bold' }}>{activeCount}</span></span>
                                        <span>TOTAL <span style={{ color: '#888', fontWeight: 'bold' }}>{historyData.length}</span></span>
                                    </div>
                                </div>

                                <div className="admin-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                                    {historyData.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.15)' }}>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.3 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            <div style={{ fontSize: '0.9rem', letterSpacing: '2px' }}>NO MATCHES YET</div>
                                            <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'rgba(255,255,255,0.1)' }}>Create one using Quick Create</div>
                                        </div>
                                    ) : (
                                        historyData.map((match, i) => (
                                            <div key={i} className={`history-card ${match.finished ? 'finished' : 'active'}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 'bold', color: match.finished ? '#666' : '#fff', fontSize: '0.95rem' }}>
                                                            {match.teamA} <span style={{ color: '#444', fontWeight: 400 }}>vs</span> {match.teamB}
                                                        </span>
                                                        <span className={`format-badge ${match.format.includes('bo1') || match.format === 'bo1' ? 'bo1' : match.format.includes('bo3') || match.format === 'bo3' ? 'bo3' : 'bo5'}`}>
                                                            {match.format}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        {!match.finished && (
                                                            <button onClick={() => handleAdminUndo(match.id)} className="admin-action-btn undo" title="Undo Last Step"><UndoIcon /></button>
                                                        )}
                                                        <button onClick={() => handleAdminReset(match.id)} className="admin-action-btn reset" title={match.finished ? "Restart" : "Reset"}><RefreshIcon /></button>
                                                        <button onClick={() => deleteMatch(match.id)} className="admin-action-btn delete" title="Delete"><TrashIcon /></button>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '6px', letterSpacing: '0.5px' }}>{new Date(match.date).toLocaleString()}</div>
                                                {match.keys && (
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                                        <button onClick={() => openInNewTab(`/?room=${match.id}&key=${match.keys.admin}`)} className="match-link-btn open">OPEN</button>
                                                        <button onClick={() => copyLink(match.id, match.keys.A)} className="match-link-btn copy">LINK A</button>
                                                        <button onClick={() => copyLink(match.id, match.keys.B)} className="match-link-btn copy">LINK B</button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <button onClick={nukeHistory} className="nuke-btn">
                                    ⚠ CLEAR ALL HISTORY
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PASSWORD CHANGE MODAL */}
                {showPasswordChange && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ background: '#0a0a0f', border: '1px solid rgba(0, 212, 255, 0.15)', borderRadius: '16px', padding: '32px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
                            <h3 style={{ color: '#fff', margin: '0 0 24px 0', fontSize: '1.1rem', letterSpacing: '3px', textAlign: 'center' }}>🔑 CHANGE PASSWORD</h3>
                            {passwordError && <div style={{ color: '#ff4444', fontSize: '0.85rem', marginBottom: '12px', padding: '8px 12px', background: 'rgba(255, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(255, 68, 68, 0.15)', textAlign: 'center' }}>{passwordError}</div>}
                            {passwordSuccess && <div style={{ color: '#00ff00', fontSize: '0.85rem', marginBottom: '12px', padding: '8px 12px', background: 'rgba(0, 255, 0, 0.08)', borderRadius: '8px', border: '1px solid rgba(0, 255, 0, 0.15)', textAlign: 'center' }}>{passwordSuccess}</div>}
                            <input
                                type="password" placeholder="Current Password" value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className="admin-login-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '12px' }}
                            />
                            <input
                                type="password" placeholder="New Password" value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="admin-login-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '12px' }}
                            />
                            <input
                                type="password" placeholder="Confirm New Password" value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="admin-login-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '20px' }}
                            />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={handleChangePassword} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #00d4ff 0%, #0080ff 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '2px' }}>
                                    UPDATE
                                </button>
                                <button onClick={() => setShowPasswordChange(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.9rem', letterSpacing: '2px' }}>
                                    CANCEL
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* USER MANAGEMENT MODAL */}
                {showUserManagement && currentUser && currentUser.role === 'super_admin' && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ background: '#0a0a0f', border: '1px solid rgba(255, 165, 0, 0.15)', borderRadius: '16px', padding: '32px', width: '700px', maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }} className="admin-scroll">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem', letterSpacing: '3px' }}>👥 USER MANAGEMENT</h3>
                                <button onClick={() => setShowUserManagement(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#888', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                            </div>

                            {userError && <div style={{ color: '#ff4444', fontSize: '0.85rem', marginBottom: '16px', padding: '8px 12px', background: 'rgba(255, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(255, 68, 68, 0.15)', textAlign: 'center' }}>{userError}</div>}

                            {/* CREATE USER */}
                            <div style={{ background: 'rgba(255, 165, 0, 0.04)', border: '1px solid rgba(255, 165, 0, 0.1)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                                <h4 style={{ color: '#ffa500', margin: '0 0 16px 0', fontSize: '0.9rem', letterSpacing: '2px' }}>+ CREATE NEW USER</h4>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <input
                                        type="text" placeholder="Username" value={newUserUsername}
                                        onChange={e => setNewUserUsername(e.target.value)}
                                        className="admin-login-input" style={{ flex: 1, minWidth: '120px', boxSizing: 'border-box' }}
                                    />
                                    <input
                                        type="password" placeholder="Password" value={newUserPassword}
                                        onChange={e => setNewUserPassword(e.target.value)}
                                        className="admin-login-input" style={{ flex: 1, minWidth: '120px', boxSizing: 'border-box' }}
                                    />
                                    <select
                                        value={newUserRole} onChange={e => setNewUserRole(e.target.value)}
                                        style={{ flex: 0.7, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.9rem', outline: 'none', minWidth: '100px' }}
                                    >
                                        <option value="admin" style={{ background: '#111' }}>Admin</option>
                                        <option value="super_admin" style={{ background: '#111' }}>Super Admin</option>
                                    </select>
                                    <button onClick={handleCreateUser} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #ffa500 0%, #ff6600 100%)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                                        CREATE
                                    </button>
                                </div>
                                {/* Permission checkboxes for new user */}
                                <div style={{ marginTop: '12px' }}>
                                    <span style={{ color: '#888', fontSize: '0.75rem', letterSpacing: '1px' }}>PERMISSIONS:</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                        {allPermissions.map(p => (
                                            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: newUserPermissions.includes(p) ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${newUserPermissions.includes(p) ? 'rgba(255, 165, 0, 0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', color: newUserPermissions.includes(p) ? '#ffa500' : '#666', transition: 'all 0.2s', letterSpacing: '0.5px' }}>
                                                <input
                                                    type="checkbox" checked={newUserPermissions.includes(p)}
                                                    onChange={e => {
                                                        if (e.target.checked) setNewUserPermissions([...newUserPermissions, p]);
                                                        else setNewUserPermissions(newUserPermissions.filter(x => x !== p));
                                                    }}
                                                    style={{ display: 'none' }}
                                                />
                                                <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1px solid ${newUserPermissions.includes(p) ? '#ffa500' : '#444'}`, background: newUserPermissions.includes(p) ? '#ffa500' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                                    {newUserPermissions.includes(p) && <span style={{ color: '#000', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                                                </div>
                                                {p.replace(/_/g, ' ')}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* EXISTING USERS */}
                            <h4 style={{ color: '#fff', margin: '0 0 12px 0', fontSize: '0.9rem', letterSpacing: '2px' }}>EXISTING USERS</h4>
                            {userList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: '#555', fontSize: '0.9rem' }}>No users found</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {userList.map(user => (
                                        <div key={user.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', transition: 'border-color 0.2s' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem', letterSpacing: '1px' }}>{user.username}</span>
                                                    <select
                                                        value={user.role}
                                                        onChange={e => handleUpdateUserRole(user.id, e.target.value)}
                                                        disabled={user.id === currentUser.id}
                                                        style={{ padding: '3px 8px', background: user.role === 'super_admin' ? 'rgba(255, 0, 85, 0.1)' : 'rgba(0, 212, 255, 0.1)', border: `1px solid ${user.role === 'super_admin' ? 'rgba(255, 0, 85, 0.2)' : 'rgba(0, 212, 255, 0.2)'}`, borderRadius: '4px', color: user.role === 'super_admin' ? '#ff0055' : '#00d4ff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px', outline: 'none', cursor: user.id === currentUser.id ? 'not-allowed' : 'pointer', opacity: user.id === currentUser.id ? 0.5 : 1 }}
                                                    >
                                                        <option value="admin" style={{ background: '#111' }}>Admin</option>
                                                        <option value="super_admin" style={{ background: '#111' }}>Super Admin</option>
                                                    </select>
                                                    {user.id === currentUser.id && <span style={{ color: '#555', fontSize: '0.7rem' }}>(you)</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        onClick={() => handleResetUserPassword(user.id)}
                                                        style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(0, 212, 255, 0.2)', color: '#00d4ff', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', letterSpacing: '1px' }}
                                                        title="Reset password to 'password123'"
                                                    >
                                                        RESET PW
                                                    </button>
                                                    {user.id !== currentUser.id && (
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255, 68, 68, 0.2)', color: '#ff4444', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', letterSpacing: '1px' }}
                                                        >
                                                            DELETE
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Permissions */}
                                            {user.role !== 'super_admin' && (
                                                <div>
                                                    <span style={{ color: '#666', fontSize: '0.7rem', letterSpacing: '1px' }}>PERMISSIONS:</span>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                                                        {allPermissions.map(p => {
                                                            const userPerms = Array.isArray(user.permissions) ? user.permissions : JSON.parse(user.permissions || '[]');
                                                            const has = userPerms.includes(p);
                                                            return (
                                                                <label key={p} onClick={() => {
                                                                    const perms = Array.isArray(user.permissions) ? user.permissions : JSON.parse(user.permissions || '[]');
                                                                    const newPerms = has ? perms.filter(x => x !== p) : [...perms, p];
                                                                    handleUpdateUserPermissions(user.id, newPerms);
                                                                }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: has ? 'rgba(0, 255, 0, 0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${has ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: '5px', cursor: 'pointer', fontSize: '0.7rem', color: has ? '#00ff00' : '#555', transition: 'all 0.2s', letterSpacing: '0.5px' }}>
                                                                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: `1px solid ${has ? '#00ff00' : '#444'}`, background: has ? '#00ff00' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                                                        {has && <span style={{ color: '#000', fontSize: '8px', fontWeight: 'bold' }}>✓</span>}
                                                                    </div>
                                                                    {p.replace(/_/g, ' ')}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            {user.role === 'super_admin' && (
                                                <div style={{ color: '#555', fontSize: '0.75rem', fontStyle: 'italic' }}>Super admins have all permissions</div>
                                            )}
                                            <div style={{ marginTop: '8px', color: '#444', fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                Created: {new Date(user.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MUST CHANGE PASSWORD OVERLAY */}
                {currentUser && currentUser.must_change_password === 1 && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ background: '#0a0a0f', border: '1px solid rgba(255, 165, 0, 0.2)', borderRadius: '16px', padding: '32px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.9)', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
                            <h3 style={{ color: '#ffa500', margin: '0 0 8px 0', fontSize: '1.1rem', letterSpacing: '3px' }}>PASSWORD CHANGE REQUIRED</h3>
                            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '20px' }}>You must change your default password before continuing.</p>
                            {passwordError && <div style={{ color: '#ff4444', fontSize: '0.85rem', marginBottom: '12px', padding: '8px 12px', background: 'rgba(255, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(255, 68, 68, 0.15)' }}>{passwordError}</div>}
                            {passwordSuccess && <div style={{ color: '#00ff00', fontSize: '0.85rem', marginBottom: '12px', padding: '8px 12px', background: 'rgba(0, 255, 0, 0.08)', borderRadius: '8px', border: '1px solid rgba(0, 255, 0, 0.15)' }}>{passwordSuccess}</div>}
                            <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="admin-login-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '12px' }} />
                            <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="admin-login-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '20px' }} />
                            <button
                                onClick={() => {
                                    if (!newPassword || newPassword.length < 6) { setPasswordError('Password must be at least 6 characters'); return; }
                                    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
                                    setPasswordError('');
                                    fetch(`${SOCKET_URL}/api/auth/change-password`, {
                                        method: 'POST',
                                        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ newPassword })
                                    })
                                        .then(r => r.json())
                                        .then(data => {
                                            if (data.success) {
                                                const updatedUser = { ...currentUser, must_change_password: 0 };
                                                setCurrentUser(updatedUser);
                                                localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                                                setPasswordSuccess('Password changed! Redirecting...');
                                                setTimeout(() => { setPasswordSuccess(''); setNewPassword(''); setConfirmPassword(''); }, 1500);
                                            } else {
                                                setPasswordError(data.error || 'Failed to change password');
                                            }
                                        })
                                        .catch(() => setPasswordError('Network error'));
                                }}
                                style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #ffa500 0%, #ff6600 100%)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 'bold', fontSize: '1rem', letterSpacing: '2px' }}
                            >
                                SET NEW PASSWORD
                            </button>
                        </div>
                    </div>
                )}

                {showNotification && <div style={styles.notification}><CheckIcon /> COPIED TO CLIPBOARD</div>}

                {/* Footer */}
                <div style={{ padding: '20px 32px', color: '#444', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: '500', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.02)' }}>LOTGaming System | kancha@lotgaming.xyz</div>
            </div>
        );
    }


    // --- RENDER HISTORY ---
    if (view === 'history') {
        return (
            <div style={{ minHeight: '100vh', color: '#fff', fontFamily: "'Rajdhani', sans-serif", display: 'flex', flexDirection: 'column' }}>
                <AnimatedBackground />

                <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1 }}>
                    {/* LEFT SIDEBAR */}
                    {!isMobile && (
                        <div style={{ width: '64px', minHeight: '100vh', background: 'rgba(10, 12, 20, 0.7)', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', position: 'fixed', left: 0, top: 0, zIndex: 50 }}>
                            <img src={LOGO_URL} alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '10px', marginBottom: '32px', opacity: 0.9 }} />
                            <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '24px' }} />
                            <button onClick={() => setView('home')} style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#444', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', transition: 'all 0.2s' }} title="Home">🏠</button>
                            <button style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: 'rgba(0, 212, 255, 0.1)', color: '#00d4ff', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }} title="History">📋</button>
                        </div>
                    )}

                    {/* MAIN CONTENT */}
                    <div style={{ flex: 1, marginLeft: isMobile ? 0 : '64px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                        {/* Top bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '16px' : '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {isMobile && <button onClick={() => setView('home')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#555', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', letterSpacing: '1px', fontWeight: '600' }}>← BACK</button>}
                                <div>
                                    <h1 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: '700', letterSpacing: '4px', color: '#fff' }}>MATCH HISTORY</h1>
                                    <div style={{ fontSize: '0.6rem', letterSpacing: '3px', color: '#555', fontWeight: '600', marginTop: '1px' }}>{totalPages > 0 ? `${historyData.length} RESULTS • PAGE ${currentPage} OF ${totalPages}` : 'NO RECORDS'}</div>
                                </div>
                            </div>
                            {/* Pagination */}
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                                    style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: currentPage === 1 ? 'transparent' : 'rgba(255,255,255,0.03)', color: currentPage === 1 ? '#222' : '#888', cursor: currentPage === 1 ? 'default' : 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.8rem' }}>←</button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    return (
                                        <button key={pageNum} onClick={() => handlePageChange(pageNum)}
                                            style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.78rem', background: pageNum === currentPage ? '#fff' : 'rgba(255,255,255,0.02)', color: pageNum === currentPage ? '#0a0a12' : '#555', transition: 'all 0.2s' }}>
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                                    style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: currentPage === totalPages ? 'transparent' : 'rgba(255,255,255,0.03)', color: currentPage === totalPages ? '#222' : '#888', cursor: currentPage === totalPages ? 'default' : 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.8rem' }}>→</button>
                            </div>
                        </div>

                        {/* Match cards */}
                        <div style={{ flex: 1, padding: isMobile ? '16px' : '24px 32px', width: '100%', boxSizing: 'border-box' }}>
                            {historyData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#444' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.5 }}>📭</div>
                                    <div style={{ fontSize: '0.8rem', letterSpacing: '3px', fontWeight: '600' }}>NO MATCHES FOUND</div>
                                </div>
                            ) : historyData.map((match, i) => (
                                <div key={i} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '16px 20px', marginBottom: '10px', animation: `fadeIn 0.3s ease ${i * 0.04}s both`, position: 'relative', overflow: 'hidden' }}>
                                    {/* Left accent line */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '2px', background: match.format?.includes('bo1') ? '#00d4ff' : match.format?.includes('bo3') ? '#a855f7' : '#ff0055' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ color: '#00d4ff', fontWeight: '700', fontSize: '1.1rem' }}>{match.teamA}</span>
                                            <span style={{ color: '#444', fontSize: '0.7rem', fontWeight: '900', letterSpacing: '2px' }}>VS</span>
                                            <span style={{ color: '#ff0055', fontWeight: '700', fontSize: '1.1rem' }}>{match.teamB}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '0.65rem', color: '#555', letterSpacing: '0.5px' }}>{new Date(match.date).toLocaleString()}</span>
                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '1px', background: match.format?.includes('bo1') ? 'rgba(0,212,255,0.08)' : match.format?.includes('bo3') ? 'rgba(168,85,247,0.08)' : 'rgba(255,0,85,0.08)', color: match.format?.includes('bo1') ? '#00d4ff' : match.format?.includes('bo3') ? '#a855f7' : '#ff0055' }}>
                                                {match.format?.toUpperCase().replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                        {match.logs.map((l, idx) => (
                                            <div key={idx} style={{ padding: '2px 0', fontSize: '0.75rem', color: '#555', fontFamily: "'Consolas', monospace" }}>{l}</div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Bottom pagination */}
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '20px 0' }}>
                                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                                        style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: currentPage === 1 ? 'transparent' : 'rgba(255,255,255,0.03)', color: currentPage === 1 ? '#222' : '#666', cursor: currentPage === 1 ? 'default' : 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.78rem', letterSpacing: '1px' }}>PREV</button>
                                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                                        style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: currentPage === totalPages ? 'transparent' : 'rgba(255,255,255,0.03)', color: currentPage === totalPages ? '#222' : '#666', cursor: currentPage === totalPages ? 'default' : 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.78rem', letterSpacing: '1px' }}>NEXT</button>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '20px 32px', color: '#444', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: '500', borderTop: '1px solid rgba(255,255,255,0.02)' }}>LOTGaming System | kancha@lotgaming.xyz</div>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER MAIN HOME ---
    if (!params.room) {
        return (
            <div style={{ minHeight: '100vh', color: '#fff', fontFamily: "'Rajdhani', sans-serif", display: 'flex', flexDirection: 'column' }}>
                <AnimatedBackground />

                {/* ========== LEFT SIDEBAR + MAIN CONTENT LAYOUT ========== */}
                <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1 }}>

                    {/* LEFT SIDEBAR - Navigation & Branding */}
                    {!isMobile && (
                        <div style={{ width: '64px', minHeight: '100vh', background: 'rgba(10, 12, 20, 0.7)', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', position: 'fixed', left: 0, top: 0, zIndex: 50 }}>
                            <img src={LOGO_URL} alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '10px', marginBottom: '32px', opacity: 0.9 }} />
                            <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '24px' }} />
                            <button onClick={() => fetchPublicHistory(1)} style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: view === 'history' ? 'rgba(0, 212, 255, 0.1)' : 'transparent', color: view === 'history' ? '#00d4ff' : '#444', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', transition: 'all 0.2s' }} title="Match History">📋</button>
                            <div style={{ marginTop: 'auto', marginBottom: '12px' }}>
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#1a1a2e', margin: '6px auto' }} />
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#1a1a2e', margin: '6px auto' }} />
                            </div>
                        </div>
                    )}

                    {/* MAIN CONTENT AREA */}
                    <div style={{ flex: 1, marginLeft: isMobile ? 0 : '64px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

                        {/* Top bar - compact, no admin link */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '16px' : '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {isMobile && <img src={LOGO_URL} alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />}
                                <div>
                                    <h1 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: '700', letterSpacing: '4px', color: '#fff' }}>MAP VETO</h1>
                                    <div style={{ fontSize: '0.6rem', letterSpacing: '3px', color: '#555', fontWeight: '600', marginTop: '1px' }}>COUNTER-STRIKE 2</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {isMobile && <button onClick={() => fetchPublicHistory(1)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#555', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', letterSpacing: '1px', fontWeight: '600' }}>HISTORY</button>}
                            </div>
                        </div>

                        {/* Content wrapper - two-panel layout */}
                        <div style={{ flex: 1, padding: isMobile ? '20px 16px' : '32px 48px', display: 'flex', gap: isMobile ? '0' : '32px', boxSizing: 'border-box', alignItems: 'flex-start' }}>

                            {/* ===== LEFT PANEL - Match Setup ===== */}
                            <div style={{ flex: 1, minWidth: 0 }}>

                                {/* VETO MODE TABS - horizontal pill tabs */}
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', padding: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', width: 'fit-content' }}>
                                    {[
                                        { id: 'vrs', label: 'VRS' },
                                        { id: 'faceit', label: 'FACEIT' },
                                        { id: 'wingman', label: 'WINGMAN' },
                                        { id: 'custom', label: 'CUSTOM' }
                                    ].map(mode => (
                                        <button key={mode.id} onClick={() => setVetoMode(mode.id)}
                                            style={{ padding: '8px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.78rem', letterSpacing: '1.5px', transition: 'all 0.2s', background: vetoMode === mode.id ? '#fff' : 'transparent', color: vetoMode === mode.id ? '#0a0a12' : '#555' }}>
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>

                                {/* ===== TWO-COLUMN TEAM INPUT ===== */}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '16px', marginBottom: '28px' }}>
                                    {/* Team A Card */}
                                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(0, 212, 255, 0.08)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #00d4ff, transparent)' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 8px rgba(0, 212, 255, 0.4)' }} />
                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', letterSpacing: '3px', color: '#00d4ff' }}>TEAM A</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input style={{ flex: 1, padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: inputError && !teamA.trim() ? '1px solid #ff4444' : '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#fff', fontSize: '0.95rem', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '1px', outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box' }}
                                                value={teamA} onChange={e => { setTeamA(e.target.value); setInputError(false); }}
                                                placeholder="Team name" />
                                            <input type="file" ref={fileInputA} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleLogoUpload(e, 'A')} />
                                            <button onClick={() => fileInputA.current.click()} style={{ width: '42px', height: '42px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', background: teamALogo ? 'rgba(0,212,255,0.08)' : 'rgba(0,0,0,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }} title="Upload logo">
                                                {teamALogo ? <img src={teamALogo} alt="A" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px' }} /> : <UploadIcon />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Team B Card */}
                                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255, 0, 85, 0.08)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #ff0055, transparent)' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff0055', boxShadow: '0 0 8px rgba(255, 0, 85, 0.4)' }} />
                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', letterSpacing: '3px', color: '#ff0055' }}>TEAM B</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input style={{ flex: 1, padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: inputError && !teamB.trim() ? '1px solid #ff4444' : '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#fff', fontSize: '0.95rem', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '1px', outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box' }}
                                                value={teamB} onChange={e => { setTeamB(e.target.value); setInputError(false); }}
                                                placeholder="Team name" />
                                            <input type="file" ref={fileInputB} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleLogoUpload(e, 'B')} />
                                            <button onClick={() => fileInputB.current.click()} style={{ width: '42px', height: '42px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', background: teamBLogo ? 'rgba(255,0,85,0.08)' : 'rgba(0,0,0,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }} title="Upload logo">
                                                {teamBLogo ? <img src={teamBLogo} alt="B" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px' }} /> : <UploadIcon />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ===== SETTINGS ROW - inline, not stacked ===== */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
                                    {/* Timer toggle */}
                                    <div onClick={() => setUseTimer(!useTimer)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: useTimer ? 'rgba(0, 212, 255, 0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${useTimer ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255,255,255,0.04)'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none' }}>
                                        <span style={{ fontSize: '0.9rem' }}>⏱</span>
                                        <span style={{ fontSize: '0.78rem', fontWeight: '600', letterSpacing: '1px', color: useTimer ? '#00d4ff' : '#555' }}>TIMER</span>
                                        <div style={{ width: '32px', height: '18px', borderRadius: '9px', background: useTimer ? '#00d4ff' : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'all 0.3s', marginLeft: '4px' }}>
                                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: useTimer ? '16px' : '2px', transition: 'all 0.3s' }} />
                                        </div>
                                    </div>

                                    {/* Timer duration chips */}
                                    {useTimer && [30, 45, 60, 90, 120].map(s => (
                                        <button key={s} onClick={() => setTimerDuration(s)}
                                            style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.78rem', transition: 'all 0.2s', background: timerDuration === s ? '#fff' : 'rgba(255,255,255,0.02)', color: timerDuration === s ? '#0a0a12' : '#444', letterSpacing: '0.5px' }}>
                                            {s}s
                                        </button>
                                    ))}

                                    {/* Coin flip toggle */}
                                    <div onClick={() => setUseCoinFlip(!useCoinFlip)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: useCoinFlip ? 'rgba(255, 215, 0, 0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${useCoinFlip ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255,255,255,0.04)'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none' }}>
                                        <span style={{ fontSize: '0.9rem' }}>🪙</span>
                                        <span style={{ fontSize: '0.78rem', fontWeight: '600', letterSpacing: '1px', color: useCoinFlip ? '#ffd700' : '#555' }}>COIN FLIP</span>
                                        <div style={{ width: '32px', height: '18px', borderRadius: '9px', background: useCoinFlip ? '#ffd700' : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'all 0.3s', marginLeft: '4px' }}>
                                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: useCoinFlip ? '16px' : '2px', transition: 'all 0.3s' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Discord Webhook - collapsible inline */}
                                <div style={{ marginBottom: '28px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.85rem' }}>📡</span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '2px', color: '#444' }}>DISCORD WEBHOOK</span>
                                        <span style={{ fontSize: '0.6rem', color: '#555', fontStyle: 'italic' }}>optional</span>
                                    </div>
                                    <input type="text" value={tempWebhook} onChange={e => setTempWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..."
                                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', color: '#666', fontSize: '0.8rem', fontFamily: "'Consolas', monospace", boxSizing: 'border-box', outline: 'none', transition: 'all 0.3s' }} />
                                </div>

                                {/* ===== FORMAT BUTTONS - large action cards ===== */}
                                {vetoMode !== 'custom' ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: vetoMode === 'wingman' ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px', marginBottom: '32px' }}>
                                        {['bo1', 'bo3', ...(vetoMode !== 'wingman' ? ['bo5'] : [])].map(fmt => (
                                            <button key={fmt} onClick={() => createMatch(fmt)}
                                                style={{ padding: '24px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", transition: 'all 0.2s', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = fmt === 'bo1' ? 'rgba(0,212,255,0.3)' : fmt === 'bo3' ? 'rgba(168,85,247,0.3)' : 'rgba(255,0,85,0.3)'; e.currentTarget.style.background = fmt === 'bo1' ? 'rgba(0,212,255,0.04)' : fmt === 'bo3' ? 'rgba(168,85,247,0.04)' : 'rgba(255,0,85,0.04)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}>
                                                <div style={{ fontSize: '1.6rem', fontWeight: '800', letterSpacing: '3px', color: fmt === 'bo1' ? '#00d4ff' : fmt === 'bo3' ? '#a855f7' : '#ff0055', marginBottom: '4px' }}>{fmt.toUpperCase()}</div>
                                                <div style={{ fontSize: '0.65rem', color: '#444', letterSpacing: '2px', fontWeight: '600' }}>
                                                    {fmt === 'bo1' ? 'SINGLE MAP' : fmt === 'bo3' ? 'BEST OF THREE' : 'BEST OF FIVE'}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    /* ===== CUSTOM VETO BUILDER ===== */
                                    <div style={{ marginBottom: '32px' }}>
                                        {/* Map Pool */}
                                        <div style={{ marginBottom: '24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                                <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'rgba(0, 212, 255, 0.1)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700' }}>1</div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '2px', color: '#888' }}>MAP POOL</span>
                                                <span style={{ fontSize: '0.65rem', color: '#555', marginLeft: 'auto' }}>{customSelectedMaps.length} selected</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                                                {availableMaps.map(m => (
                                                    <div key={m.name} onClick={() => toggleMapSelection(m.name)}
                                                        style={{ padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', letterSpacing: '0.5px', transition: 'all 0.2s', border: customSelectedMaps.includes(m.name) ? '1px solid rgba(0, 212, 255, 0.3)' : '1px solid rgba(255,255,255,0.06)', color: customSelectedMaps.includes(m.name) ? '#00d4ff' : '#444', background: customSelectedMaps.includes(m.name) ? 'rgba(0,212,255,0.06)' : 'transparent' }}>
                                                        {customSelectedMaps.includes(m.name) && '✓ '}{m.name}
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input style={{ flex: 1, padding: '8px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', fontFamily: "'Rajdhani', sans-serif", outline: 'none', boxSizing: 'border-box' }} placeholder="Add custom map..." value={userCustomMap} onChange={e => setUserCustomMap(e.target.value)} />
                                                <button onClick={addUserMap} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(0, 212, 255, 0.2)', background: 'rgba(0, 212, 255, 0.06)', color: '#00d4ff', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.78rem', letterSpacing: '1px' }}>ADD</button>
                                            </div>
                                        </div>

                                        {/* Sequence Builder */}
                                        <div style={{ marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                                <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700' }}>2</div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '2px', color: '#888' }}>VETO SEQUENCE</span>
                                                <span style={{ fontSize: '0.65rem', color: '#555', marginLeft: 'auto' }}>{customSequence.length} steps</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                                                {[
                                                    { label: 'A BAN', t: 'A', a: 'ban', color: '#ff4444' },
                                                    { label: 'B BAN', t: 'B', a: 'ban', color: '#ff4444' },
                                                    { label: 'A PICK', t: 'A', a: 'pick', color: '#00ff88' },
                                                    { label: 'B PICK', t: 'B', a: 'pick', color: '#00ff88' },
                                                    { label: 'A SIDE', t: 'A', a: 'side', color: '#a855f7' },
                                                    { label: 'B SIDE', t: 'B', a: 'side', color: '#a855f7' },
                                                    { label: 'KNIFE', t: 'System', a: 'knife', color: '#ffa500' }
                                                ].map((step, idx) => (
                                                    <button key={idx} onClick={() => addSequenceStep(step.t, step.a)}
                                                        style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${step.color}22`, background: `${step.color}08`, color: step.color, cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.72rem', letterSpacing: '1px', transition: 'all 0.2s' }}>
                                                        + {step.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px', minHeight: '44px', display: 'flex', flexWrap: 'wrap', gap: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                {customSequence.length === 0 ? <span style={{ color: '#555', fontSize: '0.78rem', fontStyle: 'italic' }}>Click buttons above to build sequence...</span> : customSequence.map((s, i) => (
                                                    <span key={i} onClick={() => removeSequenceStep(i)}
                                                        style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#888', fontSize: '0.78rem', transition: 'all 0.2s' }}>
                                                        <span style={{ color: '#444', fontSize: '0.65rem' }}>{i + 1}.</span> {s.t} {s.a.toUpperCase()} <span style={{ color: '#ff4444', fontWeight: 'bold', marginLeft: '2px', fontSize: '0.85rem' }}>×</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <button onClick={() => createMatch('custom')}
                                            style={{ width: '100%', padding: '16px', borderRadius: '10px', border: '1px solid rgba(0, 212, 255, 0.2)', background: 'rgba(0, 212, 255, 0.06)', color: '#00d4ff', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: '700', fontSize: '0.95rem', letterSpacing: '3px', transition: 'all 0.2s' }}>
                                            GENERATE CUSTOM MATCH →
                                        </button>
                                    </div>
                                )}

                                {/* Generating spinner */}
                                {isGenerating && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={styles.spinner}></div>
                                        <span style={{ color: '#555', fontSize: '0.85rem', letterSpacing: '2px', fontWeight: '600' }}>CREATING MATCH...</span>
                                    </div>
                                )}

                                {/* Created Links - horizontal cards */}
                                {createdLinks && !isGenerating && (
                                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', animation: 'fadeIn 0.4s ease' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#555', letterSpacing: '3px', fontWeight: '700', marginBottom: '16px' }}>MATCH CREATED</div>
                                        {[
                                            { label: 'ADMIN', color: '#888', link: createdLinks.admin },
                                            { label: 'TEAM A', color: '#00d4ff', link: createdLinks.teamA },
                                            { label: 'TEAM B', color: '#ff0055', link: createdLinks.teamB }
                                        ].map((row, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: idx < 2 ? '8px' : 0, border: '1px solid rgba(255,255,255,0.03)' }}>
                                                <span style={{ color: row.color, fontWeight: '700', fontSize: '0.72rem', letterSpacing: '1px', minWidth: '55px' }}>{row.label}</span>
                                                <input readOnly style={{ flex: 1, background: 'transparent', border: 'none', color: '#00d4ff', fontFamily: "'Consolas', monospace", fontSize: '0.8rem', cursor: 'pointer', outline: 'none', textOverflow: 'ellipsis' }} value={row.link} onClick={() => handleCopyLogs(row.link)} />
                                                <button onClick={() => openInNewTab(row.link)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: row.color, padding: '4px', display: 'flex', alignItems: 'center', transition: '0.2s' }}><ExternalLinkIcon /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ===== RIGHT PANEL - Map Pool Preview & Info ===== */}
                            {!isMobile && (
                                <div style={{ flex: '0 1 380px', maxWidth: '380px', minWidth: '280px', position: 'sticky', top: '80px', alignSelf: 'flex-start' }}>
                                    {/* Map Pool Visual Grid */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00d4ff' }} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: '700', letterSpacing: '3px', color: '#555' }}>ACTIVE MAP POOL</span>
                                            <span style={{ fontSize: '0.6rem', color: '#555', marginLeft: 'auto' }}>{availableMaps.length} MAPS</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                            {availableMaps.slice(0, 9).map((m, idx) => {
                                                const mapUrls = getMapImageUrl(m.name, m.customImage);
                                                return (
                                                    <div key={m.name} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.3)', aspectRatio: '4/3', animation: `fadeIn 0.3s ease ${idx * 0.05}s both` }}>
                                                        <img src={mapUrls.primary} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, transition: 'opacity 0.3s' }}
                                                            onError={(e) => { e.target.style.opacity = '0'; }}
                                                            onMouseEnter={(e) => { e.target.style.opacity = '1'; }}
                                                            onMouseLeave={(e) => { e.target.style.opacity = '0.6'; }} />
                                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', display: 'flex', alignItems: 'flex-end' }}>
                                                            <span style={{ fontSize: '0.6rem', fontWeight: '700', letterSpacing: '0.5px', color: '#ddd', textTransform: 'capitalize' }}>{m.name}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '20px 32px', color: '#444', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: '500', borderTop: '1px solid rgba(255,255,255,0.02)' }}>LOTGaming System | kancha@lotgaming.xyz</div>
                    </div>
                </div>

                {/* Notification toast */}
                <div style={{ ...styles.notification, opacity: showNotification ? 1 : 0, transform: showNotification ? 'translateY(0)' : 'translateY(20px)' }}><CheckIcon /> COPIED TO CLIPBOARD</div>
            </div>
        );
    }

    // --- RENDER VETO ---
    if (!gameState) return <div style={styles.container}><AnimatedBackground /><h1 style={styles.neonTitle}>INITIALIZING...</h1></div>;

    // COIN FLIP OVERLAY
    if (gameState.useCoinFlip && gameState.coinFlip.status !== 'done') {
        return (
            <div style={styles.container}>
                <AnimatedBackground />
                <CoinFlipOverlay
                    gameState={gameState}
                    myRole={myRole}
                    onCall={handleCoinCall}
                    onDecide={handleCoinDecide}
                    soundEnabled={soundEnabled}
                />
            </div>
        );
    }

    const currentStep = gameState.sequence[gameState.step];
    const isActionStep = currentStep && (currentStep.a === 'ban' || currentStep.a === 'pick');
    const isSideStep = currentStep && currentStep.a === 'side';
    const isMyTurn = !gameState.finished && currentStep?.t === myRole;
    const actionColor = currentStep?.a === 'ban' ? '#ff4444' : '#00ff00';
    let sidePickMapName = gameState.lastPickedMap;
    if (!sidePickMapName && isSideStep) { const decider = gameState.maps.find(m => m.status === 'available'); if (decider) sidePickMapName = decider.name; }

    // Check if current user needs to click READY
    const showReadyButton = gameState.useTimer && !gameState.finished && (myRole === 'A' || myRole === 'B') && !gameState.ready[myRole];

    // ROLE DATA
    const roleData = getRoleLabel();

    return (
        <div style={styles.container}>
            <AnimatedBackground />

            {/* Veto Top Bar */}
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '48px', background: 'rgba(6, 8, 14, 0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <button onClick={goHome} style={{ background: 'transparent', border: 'none', color: '#555', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', letterSpacing: '1px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }} title="Exit to Main Menu"
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = '#555'}>
                    <HomeIcon /> EXIT
                </button>

                {/* Center: Format + Role */}
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '2px', background: 'rgba(255,255,255,0.04)', color: '#666', fontFamily: "'Rajdhani', sans-serif" }}>
                        {gameState.format?.toUpperCase().replace('_', ' ')}
                    </span>
                    <span style={{ color: '#444', fontSize: '0.6rem' }}>•</span>
                    <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '1px', color: roleData.color, fontFamily: "'Rajdhani', sans-serif" }}>
                        {roleData.text}
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button onClick={() => setShowRules(true)} style={{ background: 'transparent', border: 'none', color: '#444', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s' }} title="Show Rules"
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#444'}>📋</button>
                    <button
                        onClick={() => { const newState = !soundEnabled; setSoundEnabled(newState); localStorage.setItem('soundEnabled', newState); }}
                        style={{ background: 'transparent', border: 'none', color: soundEnabled ? '#00d4ff' : '#444', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s' }}
                        title={soundEnabled ? "Disable Sounds" : "Enable Sounds"}
                    >
                        {soundEnabled ? '🔊' : '🔇'}
                    </button>
                </div>
            </div>

            {showRules && <RulesModal format={gameState.format} isMobile={isMobile} onClose={() => setShowRules(false)} />}
            <div style={{ ...styles.notification, opacity: showNotification ? 1 : 0, transform: showNotification ? 'translateY(0)' : 'translateY(20px)' }}><CheckIcon /> COPIED TO CLIPBOARD</div>

            {/* SCOREBOARD */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '16px' : '40px', marginTop: '68px', justifyContent: 'center', flexWrap: 'wrap', padding: '0 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px' }}>
                    {gameState.teamALogo && <img src={gameState.teamALogo} alt="" style={{ height: isMobile ? '36px' : '44px', width: isMobile ? '36px' : '44px', objectFit: 'contain', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.12)', padding: '4px' }} />}
                    <span style={{ fontSize: isMobile ? '1.4rem' : '2rem', fontWeight: '800', textTransform: 'uppercase', color: '#00d4ff', letterSpacing: '2px', fontFamily: "'Rajdhani', sans-serif" }}>{gameState.teamA}</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#444', fontWeight: '900', letterSpacing: '4px', fontFamily: "'Rajdhani', sans-serif" }}>VS</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px', flexDirection: 'row-reverse' }}>
                    {gameState.teamBLogo && <img src={gameState.teamBLogo} alt="" style={{ height: isMobile ? '36px' : '44px', width: isMobile ? '36px' : '44px', objectFit: 'contain', borderRadius: '8px', background: 'rgba(255, 0, 85, 0.05)', border: '1px solid rgba(255, 0, 85, 0.12)', padding: '4px' }} />}
                    <span style={{ fontSize: isMobile ? '1.4rem' : '2rem', fontWeight: '800', textTransform: 'uppercase', color: '#ff0055', letterSpacing: '2px', fontFamily: "'Rajdhani', sans-serif" }}>{gameState.teamB}</span>
                </div>
            </div>

            {/* Status Bar */}
            <div style={{
                width: isMobile ? '92%' : '80%', maxWidth: '700px', textAlign: 'center', padding: '14px 20px',
                background: isMyTurn ? `rgba(${currentStep?.a === 'ban' ? '255,68,68' : '0,255,0'}, 0.04)` : 'rgba(10, 12, 20, 0.7)',
                borderRadius: '10px', margin: '20px 0 16px', transition: '0.3s ease',
                border: `1px solid ${isMyTurn ? (currentStep?.a === 'ban' ? 'rgba(255,68,68,0.15)' : 'rgba(0,255,0,0.15)') : 'rgba(255,255,255,0.04)'}`,
                backdropFilter: 'blur(8px)'
            }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', color: isMyTurn ? '#fff' : '#666', fontFamily: "'Rajdhani', sans-serif" }}>
                    {getInstruction()}
                    {!gameState.finished && <Countdown endsAt={gameState.timerEndsAt} soundEnabled={soundEnabled} />}
                </h2>
            </div>

            {/* READY BUTTON */}
            {showReadyButton && (
                <div style={{ textAlign: 'center', marginBottom: '16px', animation: 'fadeIn 0.5s ease' }}>
                    <button onClick={handleReady} style={{
                        background: 'rgba(0, 212, 255, 0.08)', color: '#00d4ff', border: '1px solid rgba(0, 212, 255, 0.2)',
                        padding: '14px 44px', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', letterSpacing: '3px',
                        cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", transition: 'all 0.3s', animation: 'glowPulse 2s ease-in-out infinite'
                    }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)'; e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.4)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)'; e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.2)'; }}>
                        ✋ READY UP
                    </button>
                </div>
            )}

            {/* Side Selection */}
            {isSideStep && (
                <div style={{ textAlign: 'center', margin: '32px 0', width: '100%' }}>
                    <div style={{ marginBottom: '20px', fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: '700', letterSpacing: '4px', color: '#555', fontFamily: "'Rajdhani', sans-serif" }}>
                        SELECT SIDE FOR <span style={{ color: '#00d4ff' }}>{sidePickMapName?.toUpperCase()}</span>
                    </div>
                    {isMyTurn ? (
                        <div style={{ display: 'flex', gap: isMobile ? '12px' : '24px', justifyContent: 'center', alignItems: 'stretch' }}>
                            <div onMouseEnter={() => setHoveredItem('CT')} onMouseLeave={() => setHoveredItem(null)}
                                style={{
                                    width: isMobile ? '45%' : '240px', cursor: 'pointer', transition: 'all 0.3s ease', borderRadius: '14px', overflow: 'hidden',
                                    background: 'rgba(10, 12, 20, 0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '16px',
                                    border: hoveredItem === 'CT' ? '1px solid rgba(79, 172, 254, 0.4)' : '1px solid rgba(255,255,255,0.04)',
                                    boxShadow: hoveredItem === 'CT' ? '0 8px 32px rgba(79, 172, 254, 0.1)' : '0 4px 16px rgba(0,0,0,0.3)',
                                    transform: hoveredItem === 'CT' ? 'scale(1.02) translateY(-2px)' : 'scale(1)'
                                }}
                                onClick={() => handleAction('CT')}>
                                <img src="/CT.png" alt="CT" style={{ width: '100%', height: isMobile ? '100px' : '180px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(79,172,254,0.15))', padding: '16px' }} />
                                <div style={{ fontSize: isMobile ? '0.85rem' : '1rem', color: '#4facfe', fontWeight: '800', letterSpacing: '3px', fontFamily: "'Rajdhani', sans-serif" }}>CT SIDE</div>
                            </div>
                            <div onMouseEnter={() => setHoveredItem('T')} onMouseLeave={() => setHoveredItem(null)}
                                style={{
                                    width: isMobile ? '45%' : '240px', cursor: 'pointer', transition: 'all 0.3s ease', borderRadius: '14px', overflow: 'hidden',
                                    background: 'rgba(10, 12, 20, 0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '16px',
                                    border: hoveredItem === 'T' ? '1px solid rgba(255, 154, 158, 0.4)' : '1px solid rgba(255,255,255,0.04)',
                                    boxShadow: hoveredItem === 'T' ? '0 8px 32px rgba(255, 154, 158, 0.1)' : '0 4px 16px rgba(0,0,0,0.3)',
                                    transform: hoveredItem === 'T' ? 'scale(1.02) translateY(-2px)' : 'scale(1)'
                                }}
                                onClick={() => handleAction('T')}>
                                <img src="/T.png" alt="T" style={{ width: '100%', height: isMobile ? '100px' : '180px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(255,154,158,0.15))', padding: '16px' }} />
                                <div style={{ fontSize: isMobile ? '0.85rem' : '1rem', color: '#ff9a9e', fontWeight: '800', letterSpacing: '3px', fontFamily: "'Rajdhani', sans-serif" }}>T SIDE</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: '#555', fontSize: '0.8rem', letterSpacing: '4px', fontWeight: '700', fontFamily: "'Rajdhani', sans-serif" }}>
                            ⏳ WAITING FOR OPPONENT...
                        </div>
                    )}
                </div>
            )}

            {/* Map Grid */}
            {!isSideStep && (
                <div style={styles.grid}>
                    {gameState.maps.map(map => {
                        const areTeamsReady = !gameState.useTimer || (gameState.ready.A && gameState.ready.B);
                        const isInteractive = areTeamsReady && isMyTurn && isActionStep && map.status === 'available';
                        const isHovered = hoveredItem === map.name;
                        const logData = getMapLogData(map.name);
                        const playIndex = gameState.playedMaps ? gameState.playedMaps.indexOf(map.name) : -1;
                        const mapOrderLabel = playIndex !== -1 ? `MAP ${playIndex + 1}` : null;

                        return (
                            <MapCard
                                key={map.name}
                                map={map}
                                isInteractive={isInteractive}
                                isHovered={isHovered}
                                onMouseEnter={() => setHoveredItem(map.name)}
                                onMouseLeave={() => setHoveredItem(null)}
                                onClick={() => isInteractive ? handleAction(map.name) : null}
                                actionColor={actionColor}
                                logData={logData}
                                mapOrderLabel={mapOrderLabel}
                                styles={styles}
                            />
                        );
                    })}
                </div>
            )}

            {/* Veto Logs */}
            <div style={styles.logContainer}>
                <div style={styles.logHeader}>
                    <span style={{ letterSpacing: '3px', fontSize: '0.7rem', color: '#444', fontWeight: '700' }}>VETO LOG</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {gameState.finished && (
                            <button onClick={() => handleCopyLogs(gameState.logs.join('\n'))} style={styles.copyBtn}>
                                <CopyIcon /> <span style={{ marginLeft: '4px' }}>COPY</span>
                            </button>
                        )}
                    </div>
                </div>
                <div style={styles.logScroll}>
                    {gameState.logs.map((log, i) => (
                        <div key={i} style={{ ...styles.logRow, animation: `fadeIn 0.2s ease ${i * 0.03}s both` }}>
                            <span style={{ color: '#444', marginRight: '12px', fontFamily: "'Consolas', monospace", fontSize: '0.7rem', minWidth: '22px' }}>{(i + 1).toString().padStart(2, '0')}</span>
                            <LogLineRenderer log={log} teamA={gameState.teamA} teamB={gameState.teamB} />
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginTop: 'auto', padding: '20px 32px', color: '#444', fontSize: '0.65rem', letterSpacing: '2px', textAlign: 'center', fontWeight: '500', borderTop: '1px solid rgba(255,255,255,0.02)' }}>LOTGaming System | kancha@lotgaming.xyz</div>
        </div>
    );
}

// --- DYNAMIC STYLES ---
const getStyles = (isMobile) => ({
    container: { minHeight: '100vh', color: '#fff', fontFamily: "'Rajdhani', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '50px', overflowX: 'hidden' },
    logo: { width: isMobile ? '60px' : '90px', filter: 'drop-shadow(0 0 20px rgba(0, 212, 255, 0.5))', borderRadius: '12px' },

    generatingBox: { marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
    spinner: { width: '44px', height: '44px', border: '3px solid rgba(0, 212, 255, 0.15)', borderTop: '3px solid #00d4ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    homeBtn: { position: 'absolute', top: isMobile ? '10px' : '20px', left: isMobile ? '10px' : '20px', background: 'rgba(10, 12, 20, 0.8)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', transition: 'all 0.3s', zIndex: 100, backdropFilter: 'blur(8px)', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '1px', fontWeight: '600' },
    neonTitle: { fontSize: isMobile ? '2rem' : '3.5rem', margin: 0, fontWeight: '700', letterSpacing: isMobile ? '3px' : '10px', background: 'linear-gradient(135deg, #00d4ff 0%, #a855f7 50%, #ff0055 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center', lineHeight: 1.1 },
    glassPanel: { background: 'rgba(10, 12, 20, 0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', padding: isMobile ? '24px 16px' : '48px 56px', textAlign: 'center', marginTop: '6vh', boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)', width: isMobile ? '92%' : '560px', position: 'relative', overflow: 'hidden' },
    notification: { position: 'fixed', bottom: '30px', right: isMobile ? '5%' : '30px', width: isMobile ? '90%' : 'auto', zIndex: 1000, background: 'rgba(10, 15, 25, 0.95)', borderLeft: '4px solid #00d4ff', padding: '14px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 32px rgba(0, 212, 255, 0.15)', transition: 'all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)', backdropFilter: 'blur(12px)', fontWeight: '600', letterSpacing: '1px' },
    input: { display: 'block', width: '100%', padding: '14px 18px', margin: '0 auto 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', color: '#fff', fontSize: '1rem', textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '2px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.3s' },
    modeBtn: { padding: isMobile ? '12px 16px' : '14px 24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0, 212, 255, 0.2)', color: '#00d4ff', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: isMobile ? '0.85rem' : '0.95rem', transition: 'all 0.3s', fontFamily: "'Rajdhani', sans-serif", flex: 1, letterSpacing: '1px', backdropFilter: 'blur(4px)' },
    modeBtnActive: { padding: isMobile ? '12px 16px' : '14px 24px', background: 'linear-gradient(135deg, #00d4ff 0%, #0080ff 100%)', border: '1px solid #00d4ff', color: '#000', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: isMobile ? '0.85rem' : '0.95rem', transition: 'all 0.3s', fontFamily: "'Rajdhani', sans-serif", boxShadow: '0 4px 20px rgba(0, 212, 255, 0.35)', flex: 1, letterSpacing: '1px' },
    tinyBtn: { padding: '6px 14px', background: 'rgba(0, 212, 255, 0.06)', border: '1px solid rgba(0, 212, 255, 0.2)', color: '#00d4ff', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Rajdhani', sans-serif", fontWeight: '600', letterSpacing: '0.5px', transition: 'all 0.2s' },
    scoreboard: { display: 'flex', alignItems: 'center', gap: isMobile ? '15px' : '40px', marginTop: '40px', flexWrap: 'wrap', justifyContent: 'center' },
    teamName: { fontSize: isMobile ? '1.4rem' : '2rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: "'Rajdhani', sans-serif" },
    vsBadge: { fontSize: '0.7rem', color: '#444', fontWeight: '900', letterSpacing: '4px' },
    statusBar: { width: isMobile ? '92%' : '80%', maxWidth: '700px', textAlign: 'center', padding: '14px 20px', background: 'rgba(10, 12, 20, 0.7)', borderRadius: '10px', margin: '20px 0 16px', border: '1px solid rgba(255,255,255,0.04)', textTransform: 'uppercase', letterSpacing: '3px', transition: '0.3s ease', fontSize: isMobile ? '0.75rem' : '0.85rem', backdropFilter: 'blur(8px)', fontWeight: '700' },
    grid: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: isMobile ? '8px' : '14px', maxWidth: '1200px', padding: '8px' },
    mapCard: { width: isMobile ? '44vw' : '150px', height: isMobile ? '56vw' : '220px', borderRadius: '10px', position: 'relative', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' },
    cardContent: { position: 'absolute', bottom: '0', width: '100%', padding: '10px', background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 70%, transparent 100%)' },
    mapTitle: { fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: '800', textTransform: 'uppercase', display: 'block', lineHeight: '1', letterSpacing: '1px' },
    badgeBan: { marginTop: '4px', color: '#ff4444', fontWeight: '700', textTransform: 'uppercase', fontSize: isMobile ? '0.65rem' : '0.75rem', letterSpacing: '1px' },
    badgePick: { marginTop: '4px', color: '#00ff88', fontWeight: '700', textTransform: 'uppercase', fontSize: isMobile ? '0.65rem' : '0.75rem', letterSpacing: '1px' },
    badgeDecider: { marginTop: '4px', color: '#ffa500', fontWeight: '700', textTransform: 'uppercase', fontSize: isMobile ? '0.65rem' : '0.75rem', letterSpacing: '1px' },
    miniSideBadge: { background: 'rgba(255,255,255,0.1)', color: '#ccc', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '3px', fontSize: '0.6rem', fontWeight: '700', letterSpacing: '0.5px', border: '1px solid rgba(255,255,255,0.08)' },
    sideSelectionContainer: { textAlign: 'center', margin: '32px 0', width: '100%' },
    sideCard: { width: isMobile ? '45%' : '240px', cursor: 'pointer', transition: 'all 0.3s ease', borderRadius: '14px', overflow: 'hidden', background: 'rgba(10, 12, 20, 0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '16px', border: '1px solid rgba(255,255,255,0.04)' },
    sideImg: { width: '100%', height: isMobile ? '100px' : '180px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.1))', padding: '16px' },
    sideLabelCT: { fontSize: isMobile ? '0.85rem' : '1rem', color: '#4facfe', fontWeight: '800', letterSpacing: '3px' },
    sideLabelT: { fontSize: isMobile ? '0.85rem' : '1rem', color: '#ff9a9e', fontWeight: '800', letterSpacing: '3px' },

    // LOG BOX STYLES
    logContainer: { width: isMobile ? '95%' : '80%', maxWidth: '700px', background: 'rgba(8, 10, 16, 0.9)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', marginTop: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden', backdropFilter: 'blur(12px)' },
    logHeader: { padding: '12px 18px', background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '700', color: '#444' },
    logScroll: { padding: '16px', maxHeight: '260px', overflowY: 'auto', background: 'rgba(5, 7, 12, 0.4)' },
    logRow: { marginBottom: '6px', display: 'flex', alignItems: 'flex-start', lineHeight: '1.5' },
    copyBtn: { background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.2)', padding: '5px 12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', color: '#00d4ff', display: 'flex', alignItems: 'center', fontSize: '0.7rem', transition: '0.2s', letterSpacing: '1px' },

    historyBtn: { marginTop: '28px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', padding: '14px 36px', borderRadius: '14px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '700', letterSpacing: '3px', transition: 'all 0.3s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontFamily: "'Rajdhani', sans-serif", textTransform: 'uppercase', backdropFilter: 'blur(4px)' },
    historyList: { width: isMobile ? '95%' : '80%', maxWidth: '800px', marginTop: '40px' },
    historyCard: { background: 'rgba(10, 15, 25, 0.9)', marginBottom: '16px', padding: '20px 24px', borderRadius: '14px', borderLeft: '3px solid #00d4ff', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'left', backdropFilter: 'blur(4px)', transition: 'all 0.2s' },
    historyHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 'bold', textTransform: 'uppercase', width: '100%' },

    backBtn: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', padding: '10px 24px', cursor: 'pointer', marginBottom: '20px', borderRadius: '10px', fontFamily: "'Rajdhani', sans-serif", fontWeight: '600', letterSpacing: '1px', transition: 'all 0.3s' },
    footer: { marginTop: 'auto', padding: '24px', color: '#555', fontSize: '0.75rem', letterSpacing: '2px', textAlign: 'center', fontWeight: '500' },

    // TEAM STYLES
    teamLogo: { height: '44px', width: '44px', objectFit: 'contain', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', padding: '4px' },
    mapOrderBadge: {
        position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.8)', border: '1px solid rgba(0, 212, 255, 0.15)', color: '#00d4ff',
        padding: '3px 10px', borderRadius: '4px', fontWeight: '700', fontSize: '0.6rem',
        zIndex: 10, backdropFilter: 'blur(4px)', letterSpacing: '2px', fontFamily: "'Rajdhani', sans-serif"
    },

    // LINK BOX STYLES
    linksBox: { marginTop: '24px', padding: '20px', background: 'rgba(10, 15, 25, 0.8)', borderRadius: '16px', border: '1px solid rgba(0, 212, 255, 0.1)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(12px)', width: '100%', boxSizing: 'border-box', animation: 'fadeIn 0.5s ease-out' },
    linkRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.04)' },
    linkInput: { flex: 1, background: 'transparent', border: 'none', color: '#00d4ff', fontFamily: "'Consolas', monospace", fontSize: '0.85rem', cursor: 'pointer', outline: 'none', textOverflow: 'ellipsis' },
    iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', padding: '5px', marginLeft: '5px', display: 'flex', alignItems: 'center', transition: '0.2s' },

    adminLinkBadge: {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        background: 'rgba(255, 255, 255, 0.05)', border: '1px dashed rgba(255,255,255,0.2)', color: '#aaa',
        padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', textDecoration: 'none', cursor: 'pointer'
    },
    copyLinkBadge: {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
        padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer'
    }
});