/**
 * UI Telemetry Engine & Performance Monitor
 * Autor: Bajureanu Nichita | Expert RC 251
 * Data: 19.05.2026 | Web Storage Integration (GDPR Compliant)
 *
 * Ziua 10 → Core Performance Beacon (păstrat integral)
 * Ziua 11 → Perechea IV: localStorage + sessionStorage + Session Duration + Opt-Out GDPR
 */

// State Preservation Engineering: Web Storage Persistence validated by: Bajureanu Nichita | 19.05.2026

(function () {
    'use strict';

    // =========================================================================
    // ZIUA 10 — BAZA: Date de mediu și performanță
    // =========================================================================
    const telemetryData = {
        appId: 'RC251-UTM-PORTFOLIO',
        timestamp: new Date().toISOString(),
        environment: {
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            devicePixelRatio: window.devicePixelRatio,
            hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
            deviceMemory: navigator.deviceMemory || 'N/A',
            networkType: navigator.connection ? navigator.connection.effectiveType : 'unknown',
            language: navigator.language
        },
        performanceMetrics: {},
        errors: []
    };

    // Dynamic Error Tracking
    window.onerror = function (message, source, lineno) {
        telemetryData.errors.push({ message, source, lineno });
        dispatchTelemetry();
    };

    // Core Web Vitals FID Estimation - primul click al utilizatorului
    document.addEventListener('click', function (e) {
        const fid = performance.now() - e.timeStamp;
        telemetryData.performanceMetrics.firstInputDelay = fid;
    }, { once: true });

    function collectPerformanceMetrics() {
        if (!window.performance || !window.performance.getEntriesByType) return;

        const navEntries = window.performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
            const timing = navEntries[0];
            telemetryData.performanceMetrics.dnsTime       = timing.domainLookupEnd - timing.domainLookupStart;
            telemetryData.performanceMetrics.tcpHandshake  = timing.connectEnd - timing.connectStart;
            telemetryData.performanceMetrics.ttfb          = timing.responseStart - timing.requestStart;
            telemetryData.performanceMetrics.domInteractive = timing.domInteractive;
            telemetryData.performanceMetrics.loadEvent     = timing.loadEventEnd - timing.loadEventStart;
        }

        const paintEntries = window.performance.getEntriesByType('paint');
        paintEntries.forEach((entry) => {
            if (entry.name === 'first-paint') {
                telemetryData.performanceMetrics.firstPaint = entry.startTime;
            } else if (entry.name === 'first-contentful-paint') {
                telemetryData.performanceMetrics.firstContentfulPaint = entry.startTime;
            }
        });

        // Integrăm profilul de sesiune (Ziua 11) în payload-ul final
        telemetryData.userProfile = buildUserProfile();

        dispatchTelemetry();
    }

    function dispatchTelemetry() {
        // Verificăm dacă utilizatorul a activat Opt-Out GDPR
        try {
            if (localStorage.getItem('utm_opt_out') === 'true') {
                console.warn(
                    '%c[TELEMETRIE] Beacon blocat — utilizatorul a refuzat telemetria (GDPR Opt-Out).',
                    'color: #ff4444; font-weight: bold;'
                );
                return;
            }
        } catch (e) { /* ignorăm erori de acces la storage */ }

        const payload  = JSON.stringify(telemetryData);
        const endpoint = 'https://analytics.rc251.utm.md/api/telemetry';

        console.group('%c[TELEMETRIE PERSISTENTĂ ACTIVĂ]', 'color: #00f2ff; font-weight: bold; font-size: 11px;');
        console.log(
            `%cUtilizatorul se află la vizita: %c${telemetryData.userProfile ? telemetryData.userProfile.historicalVisits : '—'}`,
            'color: #ffffff;', 'color: #00ff66; font-weight: bold;'
        );
        console.log(
            `%cSesiunea curentă a început la ora: %c${telemetryData.userProfile ? telemetryData.userProfile.sessionStartedAt : '—'}`,
            'color: #ffffff;', 'color: #ffcc00; font-weight: bold;'
        );
        console.log('%c[TELEMETRIE ACTIVE] Structură JSON trimisă:', 'color: #00f2ff; font-weight: bold;', telemetryData);
        console.groupEnd();

        if (navigator.sendBeacon) {
            navigator.sendBeacon(endpoint, payload);
        } else {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', endpoint, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(payload);
        }
    }

    // Lighthouse Optimization — requestIdleCallback pentru a nu bloca Main Thread
    window.addEventListener('load', function () {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => setTimeout(collectPerformanceMetrics, 500));
        } else {
            setTimeout(collectPerformanceMetrics, 500);
        }
    });

    // =========================================================================
    // ZIUA 11 — PERECHEA IV: Web Storage API
    // =========================================================================

    // --- 1. localStorage: Numărul persistent de vizite ---
    let visitCount;
    try {
        const raw = localStorage.getItem('utm_telemetry_visits');
        if (raw === null) {
            visitCount = 1;
        } else {
            const parsed = parseInt(raw, 10);
            // Storage Corruption Protection: valoare ne-numerică → resetare la stare sigură
            if (isNaN(parsed)) {
                console.warn('[TELEMETRIE] Valoare coruptă în localStorage. Resetare la 1.');
                visitCount = 1;
            } else {
                visitCount = parsed + 1;
            }
        }
        localStorage.setItem('utm_telemetry_visits', visitCount);
    } catch (e) {
        console.error('[TELEMETRIE] Eroare critică la localStorage:', e);
        visitCount = 1;
    }

    // --- 2. sessionStorage: Ora exactă a startului sesiunii ---
    let sessionStartTime;
    try {
        sessionStartTime = sessionStorage.getItem('utm_session_start_time');
        if (sessionStartTime === null) {
            const now = new Date();
            sessionStartTime = now.toTimeString().split(' ')[0]; // Format HH:MM:SS
            sessionStorage.setItem('utm_session_start_time', sessionStartTime);
        }
    } catch (e) {
        console.error('[TELEMETRIE] Eroare critică la sessionStorage:', e);
        sessionStartTime = new Date().toTimeString().split(' ')[0];
    }

    // --- 3. Construim profilul utilizatorului pentru payload ---
    function buildUserProfile() {
        return {
            historicalVisits:  visitCount,
            sessionStartedAt:  sessionStartTime,
            isNewUser:         visitCount === 1
        };
    }

    // --- 4. Session Duration Estimator ---
    // Durată (s) = Ora Închiderii − Ora Deschiderii (sessionStorage)
    // Media duratelor se salvează persistent în localStorage
    window.addEventListener('beforeunload', function () {
        try {
            const startStr = sessionStorage.getItem('utm_session_start_time');
            if (startStr) {
                const now         = new Date();
                const startDate   = new Date(now.toDateString() + ' ' + startStr);
                const durationSec = Math.round((now - startDate) / 1000);

                let durations = [];
                try {
                    const raw = localStorage.getItem('utm_session_durations');
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) durations = parsed;
                    }
                } catch (e) {
                    durations = [];
                }

                durations.push(durationSec);
                if (durations.length > 20) durations = durations.slice(-20); // păstrăm max 20 intrări
                localStorage.setItem('utm_session_durations', JSON.stringify(durations));

                const avg = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1);
                console.log(
                    `%c[TELEMETRIE] Sesiune închisă. Durată: ${durationSec}s | ` +
                    `Media ultimelor ${durations.length} sesiuni: ${avg}s`,
                    'color: #ff9900; font-weight: bold;'
                );
            }
        } catch (e) {
            console.error('[TELEMETRIE] Eroare la calcularea duratei sesiunii:', e);
        }
    });

    // --- 5. Opt-Out GDPR: bifă din footer ---
    // Dacă utilizatorul bifează "Refuză telemetria", tot storage-ul se șterge
    // și beacon-ul nu mai pornește la vizitele viitoare.
    document.addEventListener('DOMContentLoaded', function () {
        const optOutCheckbox = document.getElementById('telemetry-opt-out');
        if (!optOutCheckbox) return;

        // Restaurăm starea bifei din sesiunea anterioară
        try {
            if (localStorage.getItem('utm_opt_out') === 'true') {
                optOutCheckbox.checked = true;
            }
        } catch (e) { /* ignorăm */ }

        optOutCheckbox.addEventListener('change', function () {
            try {
                if (this.checked) {
                    // Ștergem tot, apoi restabilim doar flag-ul de opt-out
                    localStorage.clear();
                    sessionStorage.clear();
                    localStorage.setItem('utm_opt_out', 'true');
                    console.warn(
                        '%c[TELEMETRIE] Opt-Out activat. Storage complet șters (GDPR Compliant).',
                        'color: #ff4444; font-weight: bold;'
                    );
                } else {
                    localStorage.removeItem('utm_opt_out');
                    console.log(
                        '%c[TELEMETRIE] Opt-Out dezactivat. Telemetria reactivată.',
                        'color: #00ff66;'
                    );
                }
            } catch (e) {
                console.error('[TELEMETRIE] Eroare la gestionarea Opt-Out:', e);
            }
        });
    });

})();