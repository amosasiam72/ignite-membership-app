document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // ─── Birthday Notifications ──────────────────────────────────────
    const NOTIF_STORAGE_KEY = 'ignite-birthday-notifs';
    const NOTIF_DISMISSED_KEY = 'ignite-notif-dismissed';

    function getNotifiedToday() {
        try { return JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '{}'); } catch { return {}; }
    }

    function markNotified(memberId) {
        const data = getNotifiedToday();
        const today = new Date().toISOString().split('T')[0];
        if (!data._date || data._date !== today) {
            localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify({ _date: today }));
        }
        const updated = getNotifiedToday();
        updated[memberId] = true;
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
    }

    function wasNotified(memberId) {
        const data = getNotifiedToday();
        return data[memberId] === true;
    }

    async function checkBirthdayNotifications() {
        if (!currentUser) return;
        if (Notification && Notification.permission !== 'granted') {
            const dismissed = localStorage.getItem(NOTIF_DISMISSED_KEY);
            if (!dismissed) {
                document.getElementById('notification-permission-banner').classList.remove('hidden');
            }
            return;
        }
        try {
            const membersSnap = await db.collection('members').get();
            const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const today = members.filter(m => isBirthdayToday(m.dob) && !wasNotified(m.id));
            const tomorrow = members.filter(m => {
                if (!m.dob) return false;
                const d = new Date(m.dob);
                const t = new Date();
                const tmr = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
                return d.getMonth() === tmr.getMonth() && d.getDate() === tmr.getDate() && !wasNotified(m.id);
            });

            const allNotifs = [...today.map(m => ({ ...m, type: 'today' })), ...tomorrow.map(m => ({ ...m, type: 'tomorrow' }))];
            updateNotificationBell(allNotifs.length);
            renderNotificationDropdown(members);

            for (const notif of allNotifs) {
                const title = notif.type === 'today' ? `🎂 Happy Birthday, ${notif.firstName}!` : `🎂 ${notif.firstName}'s birthday is tomorrow!`;
                const body = notif.type === 'today'
                    ? `Today is ${notif.firstName} ${notif.lastName}'s birthday!`
                    : `Don't forget — ${notif.firstName} ${notif.lastName}'s birthday is tomorrow.`;
                try {
                    new Notification(title, { body, icon: 'icon-192x192.png', badge: 'icon-192x192.png', tag: `birthday-${notif.id}`, renotify: true });
                } catch {}
                markNotified(notif.id);
            }
        } catch (err) {
            console.error('Birthday notification check error:', err);
        }
    }

    function updateNotificationBell(count) {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    async function renderNotificationDropdown(allMembers) {
        const list = document.getElementById('notification-list');
        if (!list) return;
        const upcoming = (allMembers || [])
            .filter(m => m.dob && daysUntilBirthday(m.dob) <= 7 && daysUntilBirthday(m.dob) > 0)
            .sort((a, b) => daysUntilBirthday(a.dob) - daysUntilBirthday(b.dob))
            .slice(0, 8);
        if (upcoming.length === 0) {
            list.innerHTML = '<p class="empty-state">No birthdays this week</p>';
            return;
        }
        list.innerHTML = upcoming.map(m => {
            const days = daysUntilBirthday(m.dob);
            return `<div class="notification-item" onclick="navigate('member-detail', {id: '${m.id}'}); document.getElementById('notification-dropdown').classList.add('hidden');">
                <div class="notif-info">
                    <span class="notif-name">${m.firstName} ${m.lastName}</span>
                    <span class="notif-date">${days === 1 ? 'Tomorrow' : `In ${days} days`}</span>
                </div>
            </div>`;
        }).join('');
    }

    document.getElementById('notification-bell').addEventListener('click', () => {
        const dropdown = document.getElementById('notification-dropdown');
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            renderNotificationDropdown();
        }
    });

    document.addEventListener('click', e => {
        const dropdown = document.getElementById('notification-dropdown');
        const bell = document.getElementById('notification-bell');
        if (!dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && !bell.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    document.getElementById('permission-enable-btn').addEventListener('click', () => {
        requestNotificationPermission();
    });
    document.getElementById('notification-enable-btn').addEventListener('click', () => {
        requestNotificationPermission();
    });
    document.getElementById('permission-dismiss-btn').addEventListener('click', () => {
        localStorage.setItem(NOTIF_DISMISSED_KEY, '1');
        document.getElementById('notification-permission-banner').classList.add('hidden');
    });

    function requestNotificationPermission() {
        if (!('Notification' in window)) {
            showToast('Notifications not supported in this browser.', 'error');
            return;
        }
        Notification.requestPermission().then(permission => {
            document.getElementById('notification-permission-banner').classList.add('hidden');
            if (permission === 'granted') {
                showToast('Birthday notifications enabled!');
                checkBirthdayNotifications();
            } else {
                showToast('Notifications blocked. Enable them in browser settings.', 'error');
            }
        });
    }

    // ─── End Notifications ────────────────────────────────────────────

    let currentUser = null;
    let currentUserProfile = null;
    let flyerSettings = null;
    let calendarWeekOffset = 0;

    const ALL_PERMISSIONS = ['dashboard', 'members', 'birthdays', 'events', 'flyer-settings', 'user-management'];
    const PERMISSION_LABELS = {
        'dashboard': '📊 Dashboard',
        'members': '👥 Members',
        'birthdays': '🎂 Birthdays',
        'events': '📅 Events',
        'flyer-settings': '🎨 Flyer Settings',
        'user-management': '👤 User Management'
    };

    function canAccess(feature) {
        if (!currentUserProfile) return false;
        if (currentUserProfile.role === 'superadmin') return true;
        return (currentUserProfile.permissions || []).includes(feature);
    }

    function isSuperAdmin() {
        return currentUserProfile && currentUserProfile.role === 'superadmin';
    }

    function updateNavVisibility() {
        const pageToFeature = {
            'dashboard': 'dashboard',
            'members': 'members',
            'birthdays': 'birthdays',
            'events': 'events',
            'settings': 'flyer-settings'
        };
        document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
            const feature = pageToFeature[a.dataset.page];
            if (feature) a.style.display = canAccess(feature) ? '' : 'none';
        });
        document.querySelectorAll('.mobile-tab[data-page]').forEach(t => {
            const feature = pageToFeature[t.dataset.page];
            if (feature) t.style.display = canAccess(feature) ? '' : 'none';
        });
        const userMgmtSection = document.getElementById('user-management-section');
        if (userMgmtSection) userMgmtSection.style.display = isSuperAdmin() ? '' : 'none';
    }

    const DEFAULT_FLYER_SETTINGS = {
        photoEnabled: true,
        photoX: 640,
        photoY: 420,
        photoSize: 300,
        photoBorderSize: 0,
        photoBorderColor: '#ffffff',
        photoFrameEnabled: true,
        nameX: 640,
        nameY: 750,
        nameSize: 52,
        nameColor: '#ffffff',
        dateX: 640,
        dateY: 830,
        dateSize: 30,
        dateColor: '#ffffff',
        nameXNoPhoto: 640,
        nameYNoPhoto: 640,
        nameSizeNoPhoto: 52,
        nameColorNoPhoto: '#ffffff',
        dateXNoPhoto: 640,
        dateYNoPhoto: 720,
        dateSizeNoPhoto: 30,
        dateColorNoPhoto: '#ffffff',
        wishEnabled: true,
        wishX: 640,
        wishY: 900,
        wishSize: 28,
        wishColor: '#ffffff',
        wishXNoPhoto: 640,
        wishYNoPhoto: 800,
        wishSizeNoPhoto: 28,
        wishColorNoPhoto: '#ffffff',
        templateImage: null,
        templateImageNoPhoto: null
    };

    const BIRTHDAY_WISHES = [
        "{name}, happy birthday! May your day be filled with joy and blessings.",
        "Happy birthday {name}! Wishing you a year of amazing adventures.",
        "Celebrating you, {name}! Happy birthday!",
        "Happy birthday {name}! May God bless you with another year of grace.",
        "{name}, today we celebrate you! Happy birthday!",
        "Wishing a wonderful birthday to {name}!",
        "Happy birthday {name}! Shine bright and keep smiling.",
        "{name}, it's your special day! Happy birthday!",
        "May your birthday be as awesome as you are, {name}!",
        "Happy birthday {name}! Stay blessed and keep winning.",
        "{name}, another year of greatness! Happy birthday!",
        "Warmest birthday wishes to {name}!",
        "Happy birthday {name}! We're so glad you're part of our family.",
        "{name}, may your day be sweet and your year be bright. Happy birthday!",
        "Happy birthday {name}! Here's to you and another year of God's favor.",
        "{name}, you make our church family brighter! Happy birthday!"
    ];

    async function loadFlyerSettings() {
        try {
            const doc = await db.collection('settings').doc('flyer').get();
            if (doc.exists) {
                flyerSettings = { ...DEFAULT_FLYER_SETTINGS, ...doc.data() };
            } else {
                flyerSettings = { ...DEFAULT_FLYER_SETTINGS };
            }
        } catch (err) {
            console.error('Error loading flyer settings:', err);
            flyerSettings = { ...DEFAULT_FLYER_SETTINGS };
        }
    }

    let previewTemplateImage = null;
    let editorMode = 'photo';

    function switchEditorMode(mode) {
        const was = editorMode;
        if (mode === was) return;
        saveFormToSettings(was);
        editorMode = mode;
        loadSettingsToForm(mode);
        document.querySelectorAll('.editor-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
        loadPreviewTemplateForMode(mode);
        drawSettingsPreview();
    }

    function saveFormToSettings(mode) {
        if (!flyerSettings) return;
        const suffix = mode === 'nophoto' ? 'NoPhoto' : '';
        flyerSettings[`nameX${suffix}`] = parseInt(document.getElementById('settings-name-x').value) || 640;
        flyerSettings[`nameY${suffix}`] = parseInt(document.getElementById('settings-name-y').value) || 770;
        flyerSettings[`nameSize${suffix}`] = parseInt(document.getElementById('settings-name-size').value) || 52;
        flyerSettings[`nameColor${suffix}`] = document.getElementById('settings-name-color').value || '#ffffff';
        flyerSettings[`dateX${suffix}`] = parseInt(document.getElementById('settings-date-x').value) || 640;
        flyerSettings[`dateY${suffix}`] = parseInt(document.getElementById('settings-date-y').value) || 830;
        flyerSettings[`dateSize${suffix}`] = parseInt(document.getElementById('settings-date-size').value) || 30;
        flyerSettings[`dateColor${suffix}`] = document.getElementById('settings-date-color').value || '#ffffff';
        flyerSettings[`wishX${suffix}`] = parseInt(document.getElementById('settings-wish-x').value) || 640;
        flyerSettings[`wishY${suffix}`] = parseInt(document.getElementById('settings-wish-y').value) || 900;
        flyerSettings[`wishSize${suffix}`] = parseInt(document.getElementById('settings-wish-size').value) || 28;
        flyerSettings[`wishColor${suffix}`] = document.getElementById('settings-wish-color').value || '#ffffff';
    }

    function loadSettingsToForm(mode) {
        if (!flyerSettings) return;
        const suffix = mode === 'nophoto' ? 'NoPhoto' : '';
        document.getElementById('settings-name-x').value = flyerSettings[`nameX${suffix}`] ?? 640;
        document.getElementById('settings-name-y').value = flyerSettings[`nameY${suffix}`] ?? 770;
        document.getElementById('settings-name-size').value = flyerSettings[`nameSize${suffix}`] ?? 52;
        document.getElementById('settings-name-color').value = flyerSettings[`nameColor${suffix}`] ?? '#ffffff';
        const nsVal = document.querySelector('#name-size-val');
        if (nsVal) nsVal.textContent = document.getElementById('settings-name-size').value;
        document.getElementById('settings-date-x').value = flyerSettings[`dateX${suffix}`] ?? 640;
        document.getElementById('settings-date-y').value = flyerSettings[`dateY${suffix}`] ?? 830;
        document.getElementById('settings-date-size').value = flyerSettings[`dateSize${suffix}`] ?? 30;
        document.getElementById('settings-date-color').value = flyerSettings[`dateColor${suffix}`] ?? '#ffffff';
        const dsVal = document.querySelector('#date-size-val');
        if (dsVal) dsVal.textContent = document.getElementById('settings-date-size').value;
        document.getElementById('settings-wish-x').value = flyerSettings[`wishX${suffix}`] ?? 640;
        document.getElementById('settings-wish-y').value = flyerSettings[`wishY${suffix}`] ?? 900;
        document.getElementById('settings-wish-size').value = flyerSettings[`wishSize${suffix}`] ?? 28;
        document.getElementById('settings-wish-color').value = flyerSettings[`wishColor${suffix}`] ?? '#ffffff';
        const wsVal = document.querySelector('#wish-size-val');
        if (wsVal) wsVal.textContent = document.getElementById('settings-wish-size').value;
    }

    function loadPreviewTemplateForMode(mode) {
        const src = mode === 'nophoto'
            ? (flyerSettings?.templateImageNoPhoto || FLYER_TEMPLATE)
            : (flyerSettings?.templateImage || FLYER_TEMPLATE);
        if (!previewTemplateImage || previewTemplateImage._src !== src) {
            previewTemplateImage = new Image();
            previewTemplateImage._src = src;
            previewTemplateImage.onload = () => drawSettingsPreview();
            previewTemplateImage.src = src;
        }
    }
    
    async function drawSettingsPreview() {
        const canvas = document.getElementById('settings-preview-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        const photoEnabled = document.getElementById('settings-photo-enabled').checked;
        const photoSize = parseInt(document.getElementById('settings-photo-size').value) || 300;
        const photoX = parseInt(document.getElementById('settings-photo-x').value) || 640;
        const photoY = parseInt(document.getElementById('settings-photo-y').value) || 400;
        const photoBorderSize = parseInt(document.getElementById('settings-photo-border-size').value) || 0;
        const photoBorderColor = document.getElementById('settings-photo-border-color').value || '#ffffff';
        
        const nameX = parseInt(document.getElementById('settings-name-x').value) || 640;
        const nameY = parseInt(document.getElementById('settings-name-y').value) || 770;
        const nameSize = parseInt(document.getElementById('settings-name-size').value) || 56;
        const nameColor = document.getElementById('settings-name-color').value || '#ffffff';
        
        const dateX = parseInt(document.getElementById('settings-date-x').value) || 640;
        const dateY = parseInt(document.getElementById('settings-date-y').value) || 840;
        const dateSize = parseInt(document.getElementById('settings-date-size').value) || 32;
        const dateColor = document.getElementById('settings-date-color').value || '#ffffff';

        const wishX = parseInt(document.getElementById('settings-wish-x').value) || 640;
        const wishY = parseInt(document.getElementById('settings-wish-y').value) || 900;
        const wishSize = parseInt(document.getElementById('settings-wish-size').value) || 28;
        const wishColor = document.getElementById('settings-wish-color').value || '#ffffff';

        const nameEnabled = document.getElementById('settings-name-enabled').checked;
        const dateEnabled = document.getElementById('settings-date-enabled').checked;
        const wishEnabled = document.getElementById('settings-wish-enabled').checked;
        
        const templateSrc = editorMode === 'nophoto'
            ? (flyerSettings && flyerSettings.templateImageNoPhoto ? flyerSettings.templateImageNoPhoto : FLYER_TEMPLATE)
            : (flyerSettings && flyerSettings.templateImage ? flyerSettings.templateImage : FLYER_TEMPLATE);
        
        const render = async () => {
            ctx.clearRect(0, 0, 1280, 1280);
            ctx.drawImage(previewTemplateImage, 0, 0, 1280, 1280);
            
            if (photoEnabled) {
                await drawPhotoPlaceholder(ctx, photoX, photoY, photoBorderSize, photoBorderColor);
                if (document.getElementById('settings-photo-frame-enabled').checked) {
                    drawAccentFrame(ctx, photoX, photoY);
                }
            }
            
            if (nameEnabled) {
                drawCustomText(ctx, "John Doe", nameX, nameY, nameSize, nameColor);
            }
            if (dateEnabled) {
                drawCustomText(ctx, "21st May", dateX, dateY, dateSize, dateColor);
            }
            if (wishEnabled) {
                drawWrappedText(ctx, "Happy Birthday, John! May your day be filled with joy and blessings", wishX, wishY, wishSize, wishColor, 900);
            }

            // Draw selection highlight
            if (selectedElement) {
                ctx.save();
                const sel = selectedElement;
                let sx, sy, sw, sh;
                if (sel === 'photo') {
                    sx = photoX - PHOTO_W / 2;
                    sy = photoY - PHOTO_H / 2;
                    sw = PHOTO_W;
                    sh = PHOTO_H;
                } else if (sel === 'name') {
                    const metrics = ctx.measureText("John Doe");
                    sx = nameX - metrics.width / 2 - 10;
                    sy = nameY - nameSize / 2 - 8;
                    sw = metrics.width + 20;
                    sh = nameSize + 16;
                } else if (sel === 'date') {
                    const metrics = ctx.measureText("21st May");
                    sx = dateX - metrics.width / 2 - 10;
                    sy = dateY - dateSize / 2 - 8;
                    sw = metrics.width + 20;
                    sh = dateSize + 16;
                } else if (sel === 'wish') {
                    const metrics = ctx.measureText("Happy Birthday, John!");
                    sx = wishX - metrics.width / 2 - 10;
                    sy = wishY - wishSize / 2 - 8;
                    sw = metrics.width + 20;
                    sh = wishSize + 16;
                }
                ctx.strokeStyle = '#FF6B35';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(sx, sy, sw, sh);
                ctx.setLineDash([]);
                ctx.restore();
            }
        };
        
        if (previewTemplateImage && previewTemplateImage._src === templateSrc) {
            await render();
        } else {
            previewTemplateImage = new Image();
            previewTemplateImage._src = templateSrc;
            previewTemplateImage.onload = async () => {
                await render();
            };
            previewTemplateImage.src = templateSrc;
        }
    }
    
    async function drawPhotoPlaceholder(ctx, x, y, borderSize, borderColor) {
        ctx.save();
        const left = x - PHOTO_W / 2;
        const top = y - PHOTO_H / 2;

        if (borderSize > 0) {
            ctx.fillStyle = borderColor;
            ctx.fillRect(left - borderSize, top - borderSize, PHOTO_W + borderSize * 2, PHOTO_H + borderSize * 2);
        }
        
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(left, top, PHOTO_W, PHOTO_H);
        
        const logo = new Image();
        return new Promise((resolve) => {
            logo.onload = () => {
                ctx.save();
                ctx.beginPath();
                ctx.rect(left, top, PHOTO_W, PHOTO_H);
                ctx.clip();
                const logoSize = Math.min(PHOTO_W, PHOTO_H) * 0.5;
                ctx.drawImage(logo, x - logoSize/2, y - logoSize/2, logoSize, logoSize);
                ctx.restore();
                resolve();
            };
            logo.onerror = () => {
                ctx.fillStyle = '#64748b';
                ctx.font = 'bold 28px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('PHOTO', x, y - 10);
                ctx.fillText('376×567', x, y + 20);
                resolve();
            };
            logo.src = 'Ignite chapel no bg.png';
        });
    }
    
    function drawCustomText(ctx, text, x, y, size, color) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.font = `bold ${size}px Arial, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    function drawWrappedText(ctx, text, x, y, size, color, maxWidth, lineGap = 1.25) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.font = `bold ${size}px Arial, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;

        const words = text.split(' ');
        const lines = [];
        let line = '';
        for (const word of words) {
            const test = line ? line + ' ' + word : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);

        const lineHeight = size * lineGap;
        const startY = y - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((l, i) => {
            ctx.fillText(l, x, startY + i * lineHeight);
        });
        ctx.restore();
    }

    const PHOTO_W = 376, PHOTO_H = 567;

    function drawPhotoOnFlyer(ctx, src, x, y, borderSize = 0, borderColor = '#ffffff', frameEnabled = false) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                ctx.save();
                const left = x - PHOTO_W / 2;
                const top = y - PHOTO_H / 2;

                if (borderSize > 0) {
                    ctx.save();
                    ctx.fillStyle = borderColor;
                    ctx.fillRect(left - borderSize, top - borderSize, PHOTO_W + borderSize * 2, PHOTO_H + borderSize * 2);
                    ctx.restore();
                }
                
                ctx.beginPath();
                ctx.rect(left, top, PHOTO_W, PHOTO_H);
                ctx.clip();
                
                const aspect = img.width / img.height;
                const targetRatio = PHOTO_W / PHOTO_H;
                let sw, sh, sx, sy;
                if (aspect > targetRatio) {
                    sh = img.height;
                    sw = sh * targetRatio;
                    sx = (img.width - sw) / 2;
                    sy = 0;
                } else {
                    sw = img.width;
                    sh = sw / targetRatio;
                    sx = 0;
                    sy = (img.height - sh) / 2;
                }
                ctx.drawImage(img, sx, sy, sw, sh, left, top, PHOTO_W, PHOTO_H);
                ctx.restore();

                if (frameEnabled) {
                    drawAccentFrame(ctx, x, y);
                }
                resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
        });
    }

    function drawAccentFrame(ctx, x, y) {
        ctx.save();
        const pad = 12;
        const radius = 24;
        const left = x - PHOTO_W / 2 - pad;
        const top = y - PHOTO_H / 2 - pad;
        const w = PHOTO_W + pad * 2;
        const h = PHOTO_H + pad * 2;

        drawRoundRect(ctx, left, top, w, h, radius);
        ctx.strokeStyle = '#FF6B35';
        ctx.lineWidth = 14;
        ctx.stroke();

        drawRoundRect(ctx, left + 7, top + 7, w - 14, h - 14, radius - 6);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
    }

    let selectedElement = null;
    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0;

    function populateSettingsForm() {
        if (!flyerSettings) return;

        document.getElementById('settings-photo-enabled').checked = flyerSettings.photoEnabled;
        document.getElementById('settings-photo-size').value = flyerSettings.photoSize;
        document.getElementById('photo-size-val').textContent = flyerSettings.photoSize;
        document.getElementById('settings-photo-border-size').value = flyerSettings.photoBorderSize;
        document.getElementById('photo-border-val').textContent = flyerSettings.photoBorderSize;
        document.getElementById('settings-photo-border-color').value = flyerSettings.photoBorderColor;
        document.getElementById('settings-photo-frame-enabled').checked = flyerSettings.photoFrameEnabled !== false;
        document.getElementById('settings-photo-x').value = flyerSettings.photoX;
        document.getElementById('settings-photo-y').value = flyerSettings.photoY;

        document.getElementById('settings-name-enabled').checked = true;
        document.getElementById('settings-name-size').value = flyerSettings.nameSize;
        document.getElementById('name-size-val').textContent = flyerSettings.nameSize;
        document.getElementById('settings-name-color').value = flyerSettings.nameColor;
        document.getElementById('settings-name-bold').checked = true;
        document.getElementById('settings-name-x').value = flyerSettings.nameX;
        document.getElementById('settings-name-y').value = flyerSettings.nameY;

        document.getElementById('settings-date-enabled').checked = true;
        document.getElementById('settings-date-size').value = flyerSettings.dateSize;
        document.getElementById('date-size-val').textContent = flyerSettings.dateSize;
        document.getElementById('settings-date-color').value = flyerSettings.dateColor;
        document.getElementById('settings-date-bold').checked = true;
        document.getElementById('settings-date-x').value = flyerSettings.dateX;
        document.getElementById('settings-date-y').value = flyerSettings.dateY;

        document.getElementById('settings-wish-enabled').checked = flyerSettings.wishEnabled !== false;
        document.getElementById('settings-wish-size').value = flyerSettings.wishSize;
        document.getElementById('wish-size-val').textContent = flyerSettings.wishSize;
        document.getElementById('settings-wish-color').value = flyerSettings.wishColor;
        document.getElementById('settings-wish-bold').checked = true;
        document.getElementById('settings-wish-x').value = flyerSettings.wishX;
        document.getElementById('settings-wish-y').value = flyerSettings.wishY;
        
        // NoPhoto hidden inputs are loaded implicitly via loadSettingsToForm on tab switch
    }

    function updateDrawSettingsPreview() {
        if (selectedElement) {
            const hiddenX = document.getElementById(`settings-${selectedElement}-x`);
            const hiddenY = document.getElementById(`settings-${selectedElement}-y`);
            if (hiddenX && hiddenY) {
                const suffix = editorMode === 'nophoto' && selectedElement !== 'photo' ? 'NoPhoto' : '';
                flyerSettings[`${selectedElement}X${suffix}`] = parseInt(hiddenX.value);
                flyerSettings[`${selectedElement}Y${suffix}`] = parseInt(hiddenY.value);
            }
        }
        drawSettingsPreview();
    }

    function showControls(element) {
        ['photo', 'name', 'date', 'wish'].forEach(el => {
            const show = el === element;
            document.getElementById(`controls-${el}`).classList.toggle('hidden', !show);
            document.querySelector(`[data-element="${el}"]`)?.classList.toggle('active', show);
        });
        document.getElementById('controls-placeholder').classList.toggle('hidden', !!element);
        selectedElement = element;
    }

    function getCanvasCoords(e) {
        const canvas = document.getElementById('settings-preview-canvas');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function hitTestElement(cx, cy) {
        const settings = flyerSettings || DEFAULT_FLYER_SETTINGS;
        const elements = [];
        const suffix = editorMode === 'nophoto' ? 'NoPhoto' : '';
        if (document.getElementById('settings-photo-enabled').checked) {
            const s = settings.photoSize || 300;
            elements.push({ name: 'photo', x: settings.photoX, y: settings.photoY, hitR: Math.max(PHOTO_W, PHOTO_H) * 0.5 });
        }
        if (document.getElementById('settings-name-enabled').checked) {
            const nx = settings[`nameX${suffix}`];
            const ny = settings[`nameY${suffix}`];
            const ns = settings[`nameSize${suffix}`];
            elements.push({ name: 'name', x: nx, y: ny, hitR: (ns || 52) * 1.2 });
        }
        if (document.getElementById('settings-date-enabled').checked) {
            const dx = settings[`dateX${suffix}`];
            const dy = settings[`dateY${suffix}`];
            const ds = settings[`dateSize${suffix}`];
            elements.push({ name: 'date', x: dx, y: dy, hitR: (ds || 30) * 1.2 });
        }
        if (document.getElementById('settings-wish-enabled').checked) {
            const wx = settings[`wishX${suffix}`];
            const wy = settings[`wishY${suffix}`];
            const ws = settings[`wishSize${suffix}`];
            elements.push({ name: 'wish', x: wx, y: wy, hitR: (ws || 28) * 1.2 });
        }
        for (const el of elements) {
            const dist = Math.sqrt((cx - el.x) ** 2 + (cy - el.y) ** 2);
            if (dist < el.hitR) return el.name;
        }
        return null;
    }

    // Drag-and-drop on canvas
    function settingsPointerStart(e) {
        const canvas = document.getElementById('settings-preview-canvas');
        if (!canvas || !canvas.closest('.page.active')) return;
        const coords = getCanvasCoords(e);
        const hit = hitTestElement(coords.x, coords.y);
        if (hit) {
            showControls(hit);
            const el = document.querySelector(`[data-element="${hit}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const hiddenX = document.getElementById(`settings-${hit}-x`);
            const hiddenY = document.getElementById(`settings-${hit}-y`);
            if (hiddenX && hiddenY) {
                isDragging = true;
                dragOffsetX = coords.x - parseInt(hiddenX.value);
                dragOffsetY = coords.y - parseInt(hiddenY.value);
                canvas.style.cursor = 'grabbing';
            }
        }
    }

    function settingsPointerMove(e) {
        if (!isDragging || !selectedElement) return;
        const coords = getCanvasCoords(e);
        const hiddenX = document.getElementById(`settings-${selectedElement}-x`);
        const hiddenY = document.getElementById(`settings-${selectedElement}-y`);
        if (hiddenX && hiddenY) {
            hiddenX.value = Math.round(Math.max(0, Math.min(1280, coords.x - dragOffsetX)));
            hiddenY.value = Math.round(Math.max(0, Math.min(1280, coords.y - dragOffsetY)));
            drawSettingsPreview();
        }
    }

    function settingsPointerEnd() {
        if (isDragging && selectedElement) {
            const hiddenX = document.getElementById(`settings-${selectedElement}-x`);
            const hiddenY = document.getElementById(`settings-${selectedElement}-y`);
            if (hiddenX && hiddenY) {
                const suffix = editorMode === 'nophoto' && selectedElement !== 'photo' ? 'NoPhoto' : '';
                flyerSettings[`${selectedElement}X${suffix}`] = parseInt(hiddenX.value);
                flyerSettings[`${selectedElement}Y${suffix}`] = parseInt(hiddenY.value);
            }
        }
        isDragging = false;
        const canvas = document.getElementById('settings-preview-canvas');
        if (canvas) canvas.style.cursor = 'default';
    }

    document.addEventListener('mousedown', settingsPointerStart);
    document.addEventListener('mousemove', settingsPointerMove);
    document.addEventListener('mouseup', settingsPointerEnd);

    document.addEventListener('touchstart', e => {
        const t = e.changedTouches[0];
        settingsPointerStart({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });
    document.addEventListener('touchmove', e => {
        const t = e.changedTouches[0];
        settingsPointerMove({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });
    document.addEventListener('touchend', settingsPointerEnd);

    // Layer click handler
    document.querySelectorAll('.editor-layer').forEach(layer => {
        layer.addEventListener('click', e => {
            if (e.target.closest('.layer-toggle')) return;
            const el = layer.dataset.element;
            showControls(el);
        });
    });

    // Editor mode tabs
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchEditorMode(tab.dataset.mode);
        });
    });

    // Range sliders live update
    document.querySelectorAll('#editor-controls input[type="range"]').forEach(slider => {
        const updateSlider = () => {
            const parent = slider.closest('.form-group');
            if (parent) {
                const valSpan = parent.querySelector('.range-value');
                if (valSpan) valSpan.textContent = slider.value;
            }
            const suffix = editorMode === 'nophoto' ? 'NoPhoto' : '';
            if (slider.id === 'settings-photo-size' || slider.id === 'settings-photo-border-size') {
                if (editorMode === 'photo') {
                    flyerSettings[slider.id.replace('settings-photo-', '')] = parseInt(slider.value);
                }
            } else if (slider.id === 'settings-name-size') {
                flyerSettings[`nameSize${suffix}`] = parseInt(slider.value);
            } else if (slider.id === 'settings-date-size') {
                flyerSettings[`dateSize${suffix}`] = parseInt(slider.value);
            } else if (slider.id === 'settings-wish-size') {
                flyerSettings[`wishSize${suffix}`] = parseInt(slider.value);
            }
            drawSettingsPreview();
        };
        slider.addEventListener('input', updateSlider);
    });

    // Color pickers
    document.querySelectorAll('#editor-controls input[type="color"]').forEach(picker => {
        picker.addEventListener('input', () => {
            const suffix = editorMode === 'nophoto' ? 'NoPhoto' : '';
            if (picker.id === 'settings-photo-border-color') {
                if (editorMode === 'photo') flyerSettings.photoBorderColor = picker.value;
            } else if (picker.id === 'settings-name-color') {
                flyerSettings[`nameColor${suffix}`] = picker.value;
            } else if (picker.id === 'settings-date-color') {
                flyerSettings[`dateColor${suffix}`] = picker.value;
            } else if (picker.id === 'settings-wish-color') {
                flyerSettings[`wishColor${suffix}`] = picker.value;
            }
            drawSettingsPreview();
        });
    });

    // Checkbox toggles
    document.querySelectorAll('#editor-controls input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', drawSettingsPreview);
    });

    // Layer visibility checkboxes
    document.querySelectorAll('.layer-toggle input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', drawSettingsPreview);
    });

    // Upload template handler
    const uploadInput = document.getElementById('settings-template-upload');
    const uploadBtn = document.getElementById('settings-upload-btn');
    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (file) {
                showToast('Loading uploaded template...', 'success');
                const compressedBase64 = await compressImage(file, 1280, 0.75);
                if (!flyerSettings) flyerSettings = { ...DEFAULT_FLYER_SETTINGS };
                flyerSettings.templateImage = compressedBase64;
                if (editorMode !== 'photo') switchEditorMode('photo');
                loadPreviewTemplateForMode('photo');
            }
        });
    }

    // Reset template button
    const resetBtn = document.getElementById('settings-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (flyerSettings) flyerSettings.templateImage = null;
            if (editorMode !== 'photo') switchEditorMode('photo');
            loadPreviewTemplateForMode('photo');
            showToast('Template reset to default');
        });
    }

    // No-photo template upload handler
    const uploadNoPhotoInput = document.getElementById('settings-template-nophoto-upload');
    const uploadNoPhotoBtn = document.getElementById('settings-upload-nophoto-btn');
    if (uploadNoPhotoBtn && uploadNoPhotoInput) {
        uploadNoPhotoBtn.addEventListener('click', () => uploadNoPhotoInput.click());
        uploadNoPhotoInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (file) {
                showToast('Loading no-photo template...', 'success');
                const compressedBase64 = await compressImage(file, 1280, 0.75);
                if (!flyerSettings) flyerSettings = { ...DEFAULT_FLYER_SETTINGS };
                flyerSettings.templateImageNoPhoto = compressedBase64;
                if (editorMode !== 'nophoto') switchEditorMode('nophoto');
                loadPreviewTemplateForMode('nophoto');
            }
        });
    }

    // Reset no-photo template button
    const resetNoPhotoBtn = document.getElementById('settings-reset-nophoto-btn');
    if (resetNoPhotoBtn) {
        resetNoPhotoBtn.addEventListener('click', () => {
            if (flyerSettings) flyerSettings.templateImageNoPhoto = null;
            if (editorMode !== 'nophoto') switchEditorMode('nophoto');
            loadPreviewTemplateForMode('nophoto');
            showToast('No-photo template reset to default');
        });
    }

    // Save handler
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            showToast('Saving settings...', 'success');
            // Save whichever mode is active to flyerSettings first
            saveFormToSettings(editorMode);
            const data = {
                photoEnabled: document.getElementById('settings-photo-enabled').checked,
                photoSize: parseInt(document.getElementById('settings-photo-size').value) || 300,
                photoX: parseInt(document.getElementById('settings-photo-x').value) || 640,
                photoY: parseInt(document.getElementById('settings-photo-y').value) || 400,
                photoBorderSize: parseInt(document.getElementById('settings-photo-border-size').value) || 0,
                photoBorderColor: document.getElementById('settings-photo-border-color').value || '#ffffff',
                photoFrameEnabled: document.getElementById('settings-photo-frame-enabled').checked,
                nameX: flyerSettings.nameX,
                nameY: flyerSettings.nameY,
                nameSize: flyerSettings.nameSize,
                nameColor: flyerSettings.nameColor,
                dateX: flyerSettings.dateX,
                dateY: flyerSettings.dateY,
                dateSize: flyerSettings.dateSize,
                dateColor: flyerSettings.dateColor,
                nameXNoPhoto: flyerSettings.nameXNoPhoto,
                nameYNoPhoto: flyerSettings.nameYNoPhoto,
                nameSizeNoPhoto: flyerSettings.nameSizeNoPhoto,
                nameColorNoPhoto: flyerSettings.nameColorNoPhoto,
                dateXNoPhoto: flyerSettings.dateXNoPhoto,
                dateYNoPhoto: flyerSettings.dateYNoPhoto,
                dateSizeNoPhoto: flyerSettings.dateSizeNoPhoto,
                dateColorNoPhoto: flyerSettings.dateColorNoPhoto,
                wishEnabled: document.getElementById('settings-wish-enabled').checked,
                wishX: flyerSettings.wishX,
                wishY: flyerSettings.wishY,
                wishSize: flyerSettings.wishSize,
                wishColor: flyerSettings.wishColor,
                wishXNoPhoto: flyerSettings.wishXNoPhoto,
                wishYNoPhoto: flyerSettings.wishYNoPhoto,
                wishSizeNoPhoto: flyerSettings.wishSizeNoPhoto,
                wishColorNoPhoto: flyerSettings.wishColorNoPhoto,
                updatedAt: new Date().toISOString()
            };
            if (flyerSettings && flyerSettings.templateImage) {
                data.templateImage = flyerSettings.templateImage;
            }
            if (flyerSettings && flyerSettings.templateImageNoPhoto) {
                data.templateImageNoPhoto = flyerSettings.templateImageNoPhoto;
            }
            try {
                await db.collection('settings').doc('flyer').set(data, { merge: true });
                flyerSettings = { ...flyerSettings, ...data };
                showToast('Flyer settings saved!');
            } catch (err) {
                showToast('Save failed: ' + err.message, 'error');
            }
        });
    }

    // Flyer preview button
    const previewBtn = document.getElementById('flyer-preview-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            showToast('Open a member profile and click "Generate Flyer" to see the result.', 'success');
        });
    }

    function compressImage(file, maxWidth = 400, quality = 0.7) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function ensureUserProfile(user) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            const existingUsers = await db.collection('users').limit(5).get();
            let hasSuperAdmin = false;
            let hasAnyUser = false;
            existingUsers.forEach(doc => {
                hasAnyUser = true;
                if (doc.data().role === 'superadmin') hasSuperAdmin = true;
            });
            const isFirstUser = !hasAnyUser;
            const profile = {
                email: user.email,
                role: isFirstUser ? 'superadmin' : 'admin',
                permissions: isFirstUser ? ALL_PERMISSIONS : [],
                displayName: user.email.split('@')[0],
                createdBy: null,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };
            await db.collection('users').doc(user.uid).set(profile);
            currentUserProfile = profile;
        } else {
            const data = userDoc.data();
            currentUserProfile = data;
            if (!data.role) {
                const existingUsers = await db.collection('users').limit(5).get();
                let hasSuperAdmin = false;
                existingUsers.forEach(doc => {
                    if (doc.data().role === 'superadmin') hasSuperAdmin = true;
                });
                const promoteToSuper = !hasSuperAdmin && existingUsers.size <= 1;
                await db.collection('users').doc(user.uid).update({
                    role: promoteToSuper ? 'superadmin' : 'admin',
                    permissions: promoteToSuper ? ALL_PERMISSIONS : (data.permissions || [])
                });
                currentUserProfile = { ...data, role: promoteToSuper ? 'superadmin' : 'admin', permissions: promoteToSuper ? ALL_PERMISSIONS : (data.permissions || []) };
            }
            if (!data.permissions && currentUserProfile.role !== 'superadmin') {
                await db.collection('users').doc(user.uid).update({ permissions: [] });
                currentUserProfile = { ...currentUserProfile, permissions: [] };
            }
            await db.collection('users').doc(user.uid).update({ lastLogin: new Date().toISOString() });
        }
    }

    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            try {
                await ensureUserProfile(user);
            } catch (err) {
                console.error('Profile error:', err);
            }
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('public-screen').classList.add('hidden');
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('register-screen').classList.add('hidden');
            document.getElementById('update-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            updateNavVisibility();
            try {
                await loadFlyerSettings();
                await loadDashboard();
                checkBirthdayNotifications();
            } catch (err) {
                console.error('Dashboard load error:', err);
            }
        } else {
            currentUser = null;
            currentUserProfile = null;
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('public-screen').classList.remove('hidden');
            document.getElementById('app').classList.add('hidden');
        }
    });

    document.getElementById('go-to-admin').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('public-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    });

    document.getElementById('go-to-public-from-login').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('public-screen').classList.remove('hidden');
        document.getElementById('login-form').reset();
        document.getElementById('login-error').textContent = '';
    });

    document.getElementById('go-to-register').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('public-screen').classList.add('hidden');
        document.getElementById('register-screen').classList.remove('hidden');
    });

    document.getElementById('go-to-public-from-register').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('register-screen').classList.add('hidden');
        document.getElementById('public-screen').classList.remove('hidden');
        document.getElementById('register-form').reset();
        document.getElementById('register-success').classList.add('hidden');
        document.getElementById('register-error').textContent = '';
    });

    document.getElementById('go-to-update').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('public-screen').classList.add('hidden');
        document.getElementById('update-screen').classList.remove('hidden');
        document.getElementById('update-search-step').classList.remove('hidden');
        document.getElementById('update-edit-step').classList.add('hidden');
        document.getElementById('update-search-form').reset();
        document.getElementById('update-search-error').textContent = '';
    });

    document.getElementById('go-to-public-from-update').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('update-screen').classList.add('hidden');
        document.getElementById('public-screen').classList.remove('hidden');
    });

    document.getElementById('back-to-search').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('update-search-step').classList.remove('hidden');
        document.getElementById('update-verify-step').classList.add('hidden');
        document.getElementById('update-edit-step').classList.add('hidden');
        document.getElementById('update-search-form').reset();
    });

    document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        e.stopPropagation();
        
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        
        console.log('Login attempt:', email);
        
        if (!email || !password) {
            errorEl.textContent = 'Please enter both email and password.';
            return;
        }

        errorEl.textContent = 'Signing in...';
        
        try {
            const result = await auth.signInWithEmailAndPassword(email, password);
            console.log('Login success:', result.user.uid);
        } catch (err) {
            console.error('Login failed:', err);
            errorEl.textContent = err.message;
        }
    });

    document.getElementById('password-toggle').addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        
        const input = document.getElementById('login-password');
        const toggle = document.getElementById('password-toggle');
        
        if (input.type === 'password') {
            input.type = 'text';
            toggle.classList.add('active');
        } else {
            input.type = 'password';
            toggle.classList.remove('active');
        }
    });

    async function checkDuplicateMember(firstName, lastName, email, phone, excludeId = null) {
        if (!firstName || !lastName) return null;
        const snap = await db.collection('members')
            .where('firstName', '==', firstName)
            .where('lastName', '==', lastName)
            .get();
        for (const doc of snap.docs) {
            if (excludeId && doc.id === excludeId) continue;
            return 'A member with this name is already registered.';
        }
        return null;
    }

    document.getElementById('register-form').addEventListener('submit', async e => {
        e.preventDefault();
        const errorEl = document.getElementById('register-error');
        const successEl = document.getElementById('register-success');
        errorEl.textContent = '';
        successEl.classList.add('hidden');

        const data = {
            pin: document.getElementById('reg-pin').value.trim(),
            firstName: document.getElementById('reg-firstName').value.trim(),
            lastName: document.getElementById('reg-lastName').value.trim(),
            dob: document.getElementById('reg-dob').value,
            phone: document.getElementById('reg-phone').value.trim(),
            email: document.getElementById('reg-email').value.trim(),
            instagram: document.getElementById('reg-instagram').value.trim(),
            tiktok: document.getElementById('reg-tiktok').value.trim(),
            source: 'self-registration',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!data.firstName || !data.lastName || !data.dob || !data.phone) {
            errorEl.textContent = 'Please fill in all required fields.';
            return;
        }

        const dup = await checkDuplicateMember(data.firstName, data.lastName, data.email, data.phone);
        if (dup) {
            errorEl.textContent = dup;
            return;
        }

        const photoFile = document.getElementById('reg-photo').files[0];
        if (photoFile) {
            data.photo = await compressImage(photoFile, 400, 0.7);
        }

        try {
            await db.collection('members').add(data);
            successEl.textContent = 'Registration successful! Your details have been submitted.';
            successEl.classList.remove('hidden');
            document.getElementById('register-form').reset();
            setTimeout(() => {
                document.getElementById('register-screen').classList.add('hidden');
                document.getElementById('public-screen').classList.remove('hidden');
                successEl.classList.add('hidden');
            }, 3000);
        } catch (err) {
            errorEl.textContent = 'Registration failed: ' + err.message;
        }
    });

    document.getElementById('update-search-form').addEventListener('submit', async e => {
        e.preventDefault();
        const errorEl = document.getElementById('update-search-error');
        errorEl.textContent = '';

        const fn = document.getElementById('search-firstName').value.trim().toLowerCase();
        const ln = document.getElementById('search-lastName').value.trim().toLowerCase();

        if (!fn || !ln) {
            errorEl.textContent = 'Please enter both first and last name.';
            return;
        }

        const snap = await db.collection('members').get();
        const matches = snap.docs.filter(d => {
            const m = d.data();
            return (m.firstName || '').toLowerCase() === fn && (m.lastName || '').toLowerCase() === ln;
        });

        if (matches.length === 0) {
            errorEl.textContent = 'No member found with that name. Check spelling or register first.';
            return;
        }

        if (matches.length > 1) {
            errorEl.textContent = 'Multiple members found. Please be more specific or contact admin.';
            return;
        }

        const member = { id: matches[0].id, ...matches[0].data() };
        document.getElementById('verify-member-id').value = member.id;
        document.getElementById('update-found-msg').textContent = `We found ${member.firstName} ${member.lastName}!`;
        document.getElementById('update-search-step').classList.add('hidden');
        document.getElementById('update-verify-step').classList.remove('hidden');
        document.getElementById('verify-error').textContent = '';
        document.getElementById('verify-phone').value = '';
    });

    document.getElementById('back-to-search-from-verify').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('update-verify-step').classList.add('hidden');
        document.getElementById('update-search-step').classList.remove('hidden');
    });

    document.getElementById('update-verify-form').addEventListener('submit', async e => {
        e.preventDefault();
        const memberId = document.getElementById('verify-member-id').value;
        const enteredPin = document.getElementById('verify-pin').value.trim();
        const errorEl = document.getElementById('verify-error');
        errorEl.textContent = '';

        console.log('Verify: memberId=' + memberId + ', pin=' + enteredPin);

        if (!enteredPin) {
            errorEl.textContent = 'Please enter your PIN.';
            return;
        }

        if (enteredPin.length !== 4) {
            errorEl.textContent = 'PIN must be 4 digits.';
            return;
        }

        if (!memberId) {
            errorEl.textContent = 'Session expired. Please search for your name again.';
            return;
        }

        let doc;
        try {
            doc = await db.collection('members').doc(memberId).get();
        } catch (err) {
            console.error('Firestore read error:', err);
            errorEl.textContent = 'Error reading data: ' + err.message;
            return;
        }
        const member = doc.data();

        if (!member) {
            errorEl.textContent = 'Member not found. Please try again.';
            return;
        }

        console.log('Stored pin:', member.pin);

        if (member.pin !== enteredPin) {
            errorEl.textContent = 'Wrong PIN. Please try again.';
            return;
        }

        document.getElementById('update-member-id').value = memberId;
        document.getElementById('upd-firstName').value = member.firstName || '';
        document.getElementById('upd-lastName').value = member.lastName || '';
        document.getElementById('upd-dob').value = member.dob || '';
        document.getElementById('upd-phone').value = member.phone || '';
        document.getElementById('upd-email').value = member.email || '';
        document.getElementById('upd-instagram').value = member.instagram || '';
        document.getElementById('upd-tiktok').value = member.tiktok || '';

        const preview = document.getElementById('upd-photo-preview');
        if (member.photo) {
            document.getElementById('upd-photo-img').src = member.photo;
            preview.classList.remove('hidden');
        } else {
            preview.classList.add('hidden');
        }

        document.getElementById('update-verify-step').classList.add('hidden');
        document.getElementById('update-edit-step').classList.remove('hidden');
    });

    document.getElementById('upd-photo').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('upd-photo-img').src = ev.target.result;
                document.getElementById('upd-photo-preview').classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('update-form').addEventListener('submit', async e => {
        e.preventDefault();
        const errorEl = document.getElementById('update-error');
        const successEl = document.getElementById('update-success');
        errorEl.textContent = '';
        successEl.classList.add('hidden');

        const memberId = document.getElementById('update-member-id').value;

        const data = {
            firstName: document.getElementById('upd-firstName').value.trim(),
            lastName: document.getElementById('upd-lastName').value.trim(),
            dob: document.getElementById('upd-dob').value,
            phone: document.getElementById('upd-phone').value.trim(),
            email: document.getElementById('upd-email').value.trim(),
            instagram: document.getElementById('upd-instagram').value.trim(),
            tiktok: document.getElementById('upd-tiktok').value.trim(),
            updatedAt: new Date().toISOString()
        };

        const photoFile = document.getElementById('upd-photo').files[0];
        if (photoFile) {
            data.photo = await compressImage(photoFile, 400, 0.7);
        }

        try {
            await db.collection('members').doc(memberId).update(data);
            successEl.textContent = 'Details updated successfully!';
            successEl.classList.remove('hidden');
        } catch (err) {
            errorEl.textContent = 'Update failed: ' + err.message;
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

    document.querySelectorAll('.nav-links a, .nav-brand').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            if (page) navigateTo(page);
        });
    });

    document.querySelectorAll('.mobile-tab').forEach(tab => {
        tab.addEventListener('click', e => {
            e.preventDefault();
            const page = tab.dataset.page;
            if (page) navigateTo(page);
        });
    });

    document.getElementById('add-member-btn').addEventListener('click', () => showMemberForm());
    document.getElementById('add-event-btn').addEventListener('click', () => showEventForm());
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('calendar-download-btn').addEventListener('click', downloadBirthdayCalendar);
    document.getElementById('calendar-prev-week').addEventListener('click', () => {
        calendarWeekOffset--;
        renderBirthdayCalendar();
    });
    document.getElementById('calendar-next-week').addEventListener('click', () => {
        calendarWeekOffset++;
        renderBirthdayCalendar();
    });
    document.getElementById('calendar-this-week').addEventListener('click', () => {
        calendarWeekOffset = 0;
        renderBirthdayCalendar();
    });

    document.getElementById('member-search').addEventListener('input', e => {
        loadMembers(e.target.value);
    });

    document.getElementById('current-year').textContent = new Date().getFullYear();

    window.showToast = showToast;
    window.navigate = navigateTo;

    async function navigateTo(page, data = {}) {
        const pageToFeature = {
            'dashboard': 'dashboard',
            'members': 'members',
            'birthdays': 'birthdays',
            'events': 'events',
            'settings': 'flyer-settings',
            'member-detail': 'members',
            'event-detail': 'events'
        };
        const requiredFeature = pageToFeature[page];
        if (requiredFeature && !canAccess(requiredFeature)) {
            showToast('You do not have access to this page.', 'error');
            return;
        }

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

        const navLink = document.querySelector(`.nav-links a[data-page="${page}"]`);
        if (navLink) navLink.classList.add('active');

        document.querySelectorAll('.mobile-tab').forEach(t => t.classList.toggle('active', t.dataset.page === page));

        switch (page) {
            case 'dashboard':
                document.getElementById('page-dashboard').classList.add('active');
                loadDashboard();
                break;
            case 'members':
                document.getElementById('page-members').classList.add('active');
                loadMembers();
                break;
            case 'birthdays':
                document.getElementById('page-birthdays').classList.add('active');
                renderBirthdayCalendar();
                break;
            case 'events':
                document.getElementById('page-events').classList.add('active');
                loadEvents();
                break;
            case 'member-detail':
                document.getElementById('page-member-detail').classList.add('active');
                loadMemberDetail(data.id);
                break;
            case 'event-detail':
                document.getElementById('page-event-detail').classList.add('active');
                loadEventDetail(data.id);
                break;
            case 'settings':
                document.getElementById('page-settings').classList.add('active');
                populateSettingsForm();
                editorMode = 'photo';
                loadSettingsToForm('photo');
                loadPreviewTemplateForMode('photo');
                document.querySelectorAll('.editor-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === 'photo'));
                drawSettingsPreview();
                if (isSuperAdmin()) loadUserManagement();
                break;
        }
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }
    window.closeModal = closeModal;

    function showToast(message, type = 'success') {
        const container = document.getElementById('messages-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    function getInitials(first, last) {
        return `${(first || '')[0]}${(last || '')[0]}`.toUpperCase();
    }

    function getAge(dob) {
        if (!dob) return '?';
        const today = new Date();
        const birth = new Date(dob);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    }

    function daysUntilBirthday(dob) {
        if (!dob) return 999;
        const today = new Date();
        const birth = new Date(dob);
        let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        if (next < today) next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
        return Math.round((next - today) / (1000 * 60 * 60 * 24));
    }

    function isBirthdayToday(dob) {
        if (!dob) return false;
        const today = new Date();
        const birth = new Date(dob);
        return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    async function loadDashboard() {
        const membersSnap = await db.collection('members').get();
        const eventsSnap = await db.collection('events').where('date', '>=', new Date().toISOString().split('T')[0]).get();

        const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const today = new Date();

        const totalMembers = members.length;
        const monthBirthdays = members.filter(m => {
            if (!m.dob) return false;
            const d = new Date(m.dob);
            return d.getMonth() === today.getMonth();
        });

        const todayBirthdays = members.filter(m => isBirthdayToday(m.dob));

        const upcoming = members
            .filter(m => {
                if (!m.dob) return false;
                const days = daysUntilBirthday(m.dob);
                return days > 0;
            })
            .sort((a, b) => daysUntilBirthday(a.dob) - daysUntilBirthday(b.dob))
            .slice(0, 20);

        const upcomingEvents = eventsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 5);

        document.getElementById('stat-total').textContent = totalMembers;
        document.getElementById('stat-month').textContent = monthBirthdays.length;
        document.getElementById('stat-events').textContent = upcomingEvents.length;

        const todaySection = document.getElementById('birthday-today-section');
        const todayGrid = document.getElementById('birthday-today-grid');
        if (todayBirthdays.length > 0) {
            todaySection.classList.remove('hidden');
            todayGrid.innerHTML = todayBirthdays.map(m => `
                <div class="birthday-card">
                    ${m.photo ? `<img src="${m.photo}" class="birthday-avatar" alt="${m.firstName}">` : `<div class="birthday-avatar">${getInitials(m.firstName, m.lastName)}</div>`}
                    <h3>${m.firstName} ${m.lastName}</h3>
                    <p>Turning ${getAge(m.dob)}!</p>
                    <button class="btn btn-secondary btn-sm" onclick="showFlyer('${m.id}')">Generate Flyer</button>
                </div>
            `).join('');
        } else {
            todaySection.classList.add('hidden');
        }

        document.getElementById('upcoming-birthdays').innerHTML = upcoming.length > 0
            ? upcoming.map(m => {
                const days = daysUntilBirthday(m.dob);
                const birth = new Date(m.dob);
                return `
                    <div class="upcoming-item">
                        <div class="upcoming-info">
                            <span class="upcoming-name" onclick="navigate('member-detail', {id: '${m.id}'})">${m.firstName} ${m.lastName}</span>
                            <span class="upcoming-date">${birth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <span class="days-badge ${days <= 7 ? 'urgent' : ''}">${days === 1 ? 'Tomorrow' : `${days}d`}</span>
                    </div>
                `;
            }).join('')
            : '<p class="empty-state">No upcoming birthdays</p>';

        document.getElementById('upcoming-events-dashboard').innerHTML = upcomingEvents.length > 0
            ? upcomingEvents.map(e => `
                <div class="event-card">
                    <div class="event-date-badge">
                        <span class="event-month">${new Date(e.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span class="event-day">${new Date(e.date).toLocaleDateString('en-US', { day: 'numeric' })}</span>
                    </div>
                    <div class="event-details">
                        <h4>${e.name}</h4>
                        ${e.time ? `<span class="event-time">${e.time}</span>` : ''}
                        ${e.location ? `<span class="event-location">${e.location}</span>` : ''}
                    </div>
                    <button class="btn btn-sm" onclick="navigate('event-detail', {id: '${e.id}'})">View</button>
                </div>
            `).join('')
            : '<p class="empty-state">No upcoming events. <a href="#" onclick="showEventForm()">Add one</a></p>';
    }

    async function loadMembers(query = '') {
        const grid = document.getElementById('members-grid');
        grid.innerHTML = '<p class="empty-state">Loading members...</p>';

        let snap;
        if (query) {
            const lower = query.toLowerCase();
            const allSnap = await db.collection('members').get();
            snap = allSnap.docs.filter(d => {
                const m = d.data();
                const name = `${m.firstName} ${m.lastName}`.toLowerCase();
                return name.includes(lower) || (m.email || '').toLowerCase().includes(lower);
            });
        } else {
            snap = (await db.collection('members').orderBy('firstName').get()).docs;
        }

        if (snap.length === 0) {
            grid.innerHTML = '<p class="empty-state">No members found. <a href="#" onclick="showMemberForm()">Add your first member</a></p>';
            return;
        }

        grid.innerHTML = snap.map(d => {
            const m = d.data();
            const id = d.id;
            return `
                <div class="member-card" onclick="navigate('member-detail', {id: '${id}'})">
                    ${m.photo ? `<img src="${m.photo}" class="member-photo" alt="${m.firstName}">` : `<div class="member-photo">${getInitials(m.firstName, m.lastName)}</div>`}
                    <div class="member-info">
                        <h3>${m.firstName} ${m.lastName}</h3>
                        <p class="member-birthday">🎂 ${m.dob ? new Date(m.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'} (${getAge(m.dob)} yrs)</p>
                        ${m.phone ? `<p class="member-contact">${m.phone}</p>` : ''}
                    </div>
                    ${isBirthdayToday(m.dob) ? '<span class="birthday-badge">Today!</span>' : ''}
                </div>
            `;
        }).join('');
    }

    async function loadMemberDetail(id) {
        const doc = await db.collection('members').doc(id).get();
        if (!doc.exists) return showToast('Member not found', 'error');

        const m = { id: doc.id, ...doc.data() };
        const container = document.getElementById('member-detail-content');

        const attendanceSnap = await db.collection('attendance')
            .where('memberId', '==', id)
            .orderBy('eventDate', 'desc')
            .limit(10)
            .get();

        const attendances = attendanceSnap.docs.map(d => d.data());

        container.innerHTML = `
            <div class="member-detail">
                <div style="margin-bottom: 1rem;">
                    <button class="btn btn-sm" onclick="navigate('members')">← Back to Members</button>
                </div>
                <div class="member-header">
                    ${m.photo ? `<img src="${m.photo}" class="detail-photo" alt="${m.firstName}">` : `<div class="detail-photo">${getInitials(m.firstName, m.lastName)}</div>`}
                    <div class="member-header-info">
                        <h1>${m.firstName} ${m.lastName}</h1>
                        <span class="age-badge">${getAge(m.dob)} years old</span>
                        <p class="birthday-text">🎂 Birthday: ${formatDate(m.dob)}</p>
                        ${isBirthdayToday(m.dob) ? '<span class="birthday-badge large">Birthday Today! 🎉</span>' : ''}
                        <div class="header-actions">
                            <button class="btn btn-primary" onclick="showMemberForm('${m.id}')">Edit</button>
                            <button class="btn btn-secondary" onclick="showFlyer('${m.id}')">Generate Birthday Flyer</button>
                            <button class="btn btn-danger" onclick="deleteMember('${m.id}')">Delete</button>
                        </div>
                    </div>
                </div>

                <div class="detail-grid">
                    <div class="detail-section">
                        <h2>Contact Info</h2>
                        <table class="detail-table">
                            ${m.phone ? `<tr><td>Phone</td><td>${m.phone}</td></tr>` : ''}
                            ${m.email ? `<tr><td>Email</td><td>${m.email}</td></tr>` : ''}
                            ${m.address ? `<tr><td>Address</td><td>${m.address}</td></tr>` : ''}
                            ${!m.phone && !m.email && !m.address ? '<tr><td colspan="2" class="empty-state">No contact info added</td></tr>' : ''}
                        </table>
                    </div>

                    <div class="detail-section">
                        <h2>Social Media</h2>
                        <table class="detail-table">
                            ${m.instagram ? `<tr><td>Instagram</td><td><a href="https://instagram.com/${m.instagram}" target="_blank">@${m.instagram}</a></td></tr>` : ''}
                            ${m.tiktok ? `<tr><td>TikTok</td><td><a href="https://tiktok.com/@${m.tiktok}" target="_blank">@${m.tiktok}</a></td></tr>` : ''}
                            ${!m.instagram && !m.tiktok ? '<tr><td colspan="2" class="empty-state">No social media added</td></tr>' : ''}
                        </table>
                    </div>

                    ${attendances.length > 0 ? `
                    <div class="detail-section">
                        <h2>Recent Attendance</h2>
                        <table class="detail-table">
                            ${attendances.map(a => `
                                <tr>
                                    <td>${a.eventName}</td>
                                    <td>${formatDate(a.eventDate)}</td>
                                    <td>${a.present ? '✅ Present' : '❌ Absent'}</td>
                                </tr>
                            `).join('')}
                        </table>
                    </div>
                    ` : ''}

                    ${m.notes ? `<div class="detail-section"><h2>Notes</h2><p>${m.notes}</p></div>` : ''}
                </div>
            </div>
        `;
    }

    window.showMemberForm = async function(id = null) {
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        title.textContent = id ? 'Edit Member' : 'Add New Member';

        let member = {};
        if (id) {
            const doc = await db.collection('members').doc(id).get();
            member = doc.data() || {};
        }

        body.innerHTML = `
            <form id="member-form" class="member-form">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="firstName">First Name *</label>
                        <input type="text" id="firstName" value="${member.firstName || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="lastName">Last Name *</label>
                        <input type="text" id="lastName" value="${member.lastName || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="dob">Date of Birth *</label>
                        <input type="date" id="dob" value="${member.dob || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" value="${member.email || ''}">
                    </div>
                    <div class="form-group">
                        <label for="phone">Phone</label>
                        <input type="tel" id="phone" value="${member.phone || ''}">
                    </div>
                </div>

                <h2 class="section-title">Birthday Photo</h2>
                <div class="form-group">
                    <label for="memberPhoto">Upload Photo</label>
                    <input type="file" id="memberPhoto" accept="image/*">
                    ${member.photo ? `<div style="margin-top: 0.5rem;"><img src="${member.photo}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" alt="Current photo"> <button type="button" class="btn btn-xs btn-danger" onclick="removeExistingPhoto()" style="margin-left: 0.5rem;">Remove</button></div>` : ''}
                </div>

                <h2 class="section-title">Social Media</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="instagram">Instagram</label>
                        <input type="text" id="instagram" value="${member.instagram || ''}">
                    </div>
                    <div class="form-group">
                        <label for="tiktok">TikTok</label>
                        <input type="text" id="tiktok" value="${member.tiktok || ''}">
                    </div>
                </div>

                <h2 class="section-title">Additional Info</h2>
                <div class="form-group">
                    <label for="address">Address</label>
                    <textarea id="address">${member.address || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="notes">Notes</label>
                    <textarea id="notes">${member.notes || ''}</textarea>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save</button>
                    <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `;

        modal.classList.remove('hidden');

        window.removeExistingPhoto = function() {
            const preview = document.querySelector('#memberPhoto').parentElement.querySelector('div');
            if (preview) preview.remove();
            window._removePhoto = true;
        };

        document.getElementById('member-form').addEventListener('submit', async e => {
            e.preventDefault();
            showToast('Saving member...', 'success');

            const data = {
                firstName: document.getElementById('firstName').value.trim(),
                lastName: document.getElementById('lastName').value.trim(),
                dob: document.getElementById('dob').value,
                email: document.getElementById('email').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                instagram: document.getElementById('instagram').value.trim(),
                tiktok: document.getElementById('tiktok').value.trim(),
                address: document.getElementById('address').value.trim(),
                notes: document.getElementById('notes').value.trim(),
                createdAt: member.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            try {
                const photoFile = document.getElementById('memberPhoto').files[0];
                if (photoFile) {
                    data.photo = await compressImage(photoFile, 400, 0.7);
                } else if (window._removePhoto) {
                    data.photo = null;
                } else if (member.photo) {
                    data.photo = member.photo;
                }

                window._removePhoto = false;

                if (id) {
                    await db.collection('members').doc(id).update(data);
                    showToast('Member updated!');
                } else {
                    const dup = await checkDuplicateMember(data.firstName, data.lastName, data.email, data.phone);
                    if (dup) {
                        showToast(dup, 'error');
                        return;
                    }
                    await db.collection('members').add(data);
                    showToast('Member added!');
                }

                closeModal();
                navigate(id ? 'member-detail' : 'members', id ? { id } : {});
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };

    window.deleteMember = async function(id) {
        if (!confirm('Are you sure you want to delete this member? This cannot be undone.')) return;
        try {
            await db.collection('members').doc(id).delete();
            showToast('Member deleted');
            navigate('members');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    async function loadEvents() {
        const today = new Date().toISOString().split('T')[0];

        const upcomingSnap = await db.collection('events').where('date', '>=', today).orderBy('date').get();
        const allSnap = await db.collection('events').orderBy('date', 'desc').get();
        const pastSnap = allSnap.docs.filter(d => d.data().date < today).slice(0, 5);

        const upcoming = upcomingSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const upcomingList = document.getElementById('upcoming-events-list');
        upcomingList.innerHTML = upcoming.length > 0
            ? upcoming.map(e => renderEventCard(e)).join('')
            : '<p class="empty-state">No upcoming events. <a href="#" onclick="showEventForm()">Add one</a></p>';

        const pastSection = document.getElementById('past-events-section');
        const pastList = document.getElementById('past-events-list');
        if (pastSnap.length > 0) {
            pastSection.classList.remove('hidden');
            pastList.innerHTML = pastSnap.map(d => renderEventCard({ id: d.id, ...d.data() }, true)).join('');
        } else {
            pastSection.classList.add('hidden');
        }
    }

    function renderEventCard(e, isPast = false) {
        const date = new Date(e.date);
        return `
            <div class="event-card ${isPast ? 'past' : ''}">
                <div class="event-date-badge ${isPast ? 'past' : ''}">
                    <span class="event-month">${date.toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span class="event-day">${date.toLocaleDateString('en-US', { day: 'numeric' })}</span>
                </div>
                <div class="event-details">
                    <h3>${e.name}</h3>
                    ${e.description ? `<p>${e.description.substring(0, 100)}${e.description.length > 100 ? '...' : ''}</p>` : ''}
                    ${e.time ? `<span class="event-time">🕐 ${e.time}</span>` : ''}
                    ${e.location ? `<span class="event-location">📍 ${e.location}</span>` : ''}
                    ${isPast ? `<span class="event-attendance">${e.attendanceCount || 0} attended</span>` : ''}
                </div>
                <button class="btn btn-sm" onclick="navigate('event-detail', {id: '${e.id}'})">${isPast ? 'View' : 'Manage Attendance'}</button>
            </div>
        `;
    }

    window.showEventForm = async function(id = null) {
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        title.textContent = id ? 'Edit Event' : 'Add Event';

        let event = {};
        if (id) {
            const doc = await db.collection('events').doc(id).get();
            event = doc.data() || {};
        }

        body.innerHTML = `
            <form id="event-form">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="eventName">Event Name *</label>
                        <input type="text" id="eventName" value="${event.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="eventDate">Date *</label>
                        <input type="date" id="eventDate" value="${event.date || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="eventTime">Time</label>
                        <input type="time" id="eventTime" value="${event.time || ''}">
                    </div>
                    <div class="form-group">
                        <label for="eventLocation">Location</label>
                        <input type="text" id="eventLocation" value="${event.location || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label for="eventDescription">Description</label>
                    <textarea id="eventDescription">${event.description || ''}</textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save Event</button>
                    <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `;

        modal.classList.remove('hidden');

        document.getElementById('event-form').addEventListener('submit', async e => {
            e.preventDefault();
            const data = {
                name: document.getElementById('eventName').value.trim(),
                date: document.getElementById('eventDate').value,
                time: document.getElementById('eventTime').value,
                location: document.getElementById('eventLocation').value.trim(),
                description: document.getElementById('eventDescription').value.trim(),
                createdAt: event.createdAt || new Date().toISOString(),
                attendanceCount: event.attendanceCount || 0
            };

            try {
                if (id) {
                    await db.collection('events').doc(id).update(data);
                    showToast('Event updated!');
                } else {
                    await db.collection('events').add(data);
                    showToast('Event added!');
                }
                closeModal();
                navigate('events');
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };

    async function loadEventDetail(id) {
        const doc = await db.collection('events').doc(id).get();
        if (!doc.exists) return showToast('Event not found', 'error');

        const event = { id: doc.id, ...doc.data() };
        const container = document.getElementById('event-detail-content');

        const attendanceSnap = await db.collection('attendance')
            .where('eventId', '==', id)
            .get();

        const attendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const allMembersSnap = await db.collection('members').orderBy('firstName').get();
        const members = allMembersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const date = new Date(event.date);

        container.innerHTML = `
            <div class="event-detail">
                <div class="event-header">
                    <div class="event-date-badge large">
                        <span class="event-month">${date.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span class="event-day">${date.toLocaleDateString('en-US', { day: 'numeric' })}</span>
                    </div>
                    <div class="event-header-info">
                        <h1>${event.name}</h1>
                        ${event.time ? `<p class="event-time">🕐 ${event.time}</p>` : ''}
                        ${event.location ? `<p class="event-location">📍 ${event.location}</p>` : ''}
                        ${event.description ? `<p class="event-desc">${event.description}</p>` : ''}
                        <div class="header-actions">
                            <button class="btn btn-danger" onclick="deleteEvent('${event.id}')">Delete Event</button>
                            <button class="btn" onclick="navigate('events')">Back to Events</button>
                        </div>
                    </div>
                </div>

                <div class="attendance-section">
                    <h2>Attendance (${attendance.length} members)</h2>

                    <div class="attendance-form">
                        <div class="attendance-add">
                            <select id="attendance-select" class="form-select">
                                <option value="">Select a member...</option>
                                ${members.map(m => `<option value="${m.id}">${m.firstName} ${m.lastName}</option>`).join('')}
                            </select>
                            <button class="btn btn-sm btn-primary" onclick="markAttendance('${event.id}', 'present')">Mark Present</button>
                        </div>
                    </div>

                    ${attendance.length > 0 ? `
                    <table class="attendance-table">
                        <thead>
                            <tr><th>Member</th><th>Status</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            ${attendance.map(a => `
                                <tr>
                                    <td onclick="navigate('member-detail', {id: '${a.memberId}'})" style="cursor:pointer; color: var(--text-primary)">${a.memberName}</td>
                                    <td><span class="status-badge ${a.present ? 'present' : 'absent'}">${a.present ? 'Present' : 'Absent'}</span></td>
                                    <td>
                                        <button class="btn btn-sm" onclick="updateAttendance('${a.id}', '${event.id}', ${!a.present})">${a.present ? 'Mark Absent' : 'Mark Present'}</button>
                                        <button class="btn btn-sm btn-danger" onclick="removeAttendance('${a.id}', '${event.id}')">Remove</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ` : '<p class="empty-state">No attendance recorded yet.</p>'}
                </div>
            </div>
        `;
    }

    window.markAttendance = async function(eventId, status) {
        const select = document.getElementById('attendance-select');
        const memberId = select.value;
        if (!memberId) return showToast('Please select a member', 'error');

        const memberDoc = await db.collection('members').doc(memberId).get();
        const member = memberDoc.data();
        const eventDoc = await db.collection('events').doc(eventId).get();
        const event = eventDoc.data();

        const existing = await db.collection('attendance')
            .where('eventId', '==', eventId)
            .where('memberId', '==', memberId)
            .get();

        const data = {
            eventId,
            memberId,
            memberName: `${member.firstName} ${member.lastName}`,
            eventName: event.name,
            eventDate: event.date,
            present: status === 'present',
            createdAt: new Date().toISOString()
        };

        if (!existing.empty) {
            await existing.docs[0].ref.update(data);
        } else {
            await db.collection('attendance').add(data);
        }

        showToast(`${member.firstName} marked ${status}`);
        loadEventDetail(eventId);
    };

    window.updateAttendance = async function(attendanceId, eventId, present) {
        await db.collection('attendance').doc(attendanceId).update({ present });
        showToast('Attendance updated');
        loadEventDetail(eventId);
    };

    window.removeAttendance = async function(attendanceId, eventId) {
        await db.collection('attendance').doc(attendanceId).delete();
        showToast('Attendance removed');
        loadEventDetail(eventId);
    };

    window.deleteEvent = async function(id) {
        if (!confirm('Delete this event and all attendance records?')) return;
        const snap = await db.collection('attendance').where('eventId', '==', id).get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        await db.collection('events').doc(id).delete();
        showToast('Event deleted');
        navigate('events');
    };

    window.showFlyer = async function(memberId) {
        const doc = await db.collection('members').doc(memberId).get();
        if (!doc.exists) return;

        const m = { id: doc.id, ...doc.data() };
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        title.textContent = '🎂 Birthday Flyer Generator';

        body.innerHTML = `
            <div class="flyer-preview">
                <p>Generating flyer for <strong>${m.firstName} ${m.lastName}</strong> (Turning ${getAge(m.dob)})</p>
                <canvas id="flyer-canvas" width="1280" height="1280"></canvas>
                <p class="form-hint" style="text-align:center;margin-top:0.75rem;">Tip: drag Name, Date, Wish, or Photo on the preview to reposition</p>
                <div class="flyer-controls">
                    <div class="flyer-control-row">
                        <select id="flyer-control-element" class="form-select">
                            <option value="name">Name</option>
                            <option value="date">Date</option>
                            <option value="wish">Wish</option>
                            <option value="photo">Photo</option>
                        </select>
                        <button type="button" id="flyer-new-wish" class="btn btn-sm">🎲 New Wish</button>
                        <button type="button" id="flyer-reset-btn" class="btn btn-sm">Reset</button>
                    </div>
                    <div class="flyer-control-row">
                        <label>Size</label>
                        <input type="range" id="flyer-control-size" min="12" max="120" value="30">
                        <span class="range-value" id="flyer-size-val">30</span>
                        <label>Color</label>
                        <input type="color" id="flyer-control-color" value="#ffffff">
                    </div>
                </div>
                <div class="flyer-actions">
                    <button class="btn btn-primary btn-lg" onclick="downloadFlyer('${m.firstName}_${m.lastName}')">Download PNG</button>
                    <button class="btn" onclick="closeModal()">Close</button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');

        const settings = flyerSettings || DEFAULT_FLYER_SETTINGS;
        const hasPhoto = !!m.photo;
        const sfx = hasPhoto ? '' : 'NoPhoto';

        const dobDate = new Date(m.dob);

        flyerState = {
            m,
            hasPhoto,
            sfx,
            dateStr: `${dobDate.getDate()}${getOrdinal(dobDate.getDate())} ${dobDate.toLocaleDateString('en-US', { month: 'long' })} ${new Date().getFullYear()}`,
            wishText: getRandomBirthdayWish(m.firstName),
            photo: { x: settings.photoX, y: settings.photoY },
            name: { x: settings[`nameX${sfx}`], y: settings[`nameY${sfx}`], size: settings[`nameSize${sfx}`], color: settings[`nameColor${sfx}`] },
            date: { x: settings[`dateX${sfx}`], y: settings[`dateY${sfx}`], size: settings[`dateSize${sfx}`], color: settings[`dateColor${sfx}`] },
            wish: { x: settings[`wishX${sfx}`], y: settings[`wishY${sfx}`], size: settings[`wishSize${sfx}`], color: settings[`wishColor${sfx}`] }
        };

        const templateSrc = hasPhoto
            ? (settings.templateImage || FLYER_TEMPLATE)
            : (settings.templateImageNoPhoto || FLYER_TEMPLATE);

        flyerState.bgImg = new Image();
        flyerState.bgImg.onload = () => { flyerState.bgReady = true; flyerState.bgFailed = false; drawMemberFlyer(); };
        flyerState.bgImg.onerror = () => { flyerState.bgFailed = true; flyerState.bgReady = true; drawMemberFlyer(); };
        flyerState.bgImg.src = templateSrc;

        drawMemberFlyer();

        const elSelect = document.getElementById('flyer-control-element');
        const sizeSlider = document.getElementById('flyer-control-size');
        const sizeVal = document.getElementById('flyer-size-val');
        const colorInput = document.getElementById('flyer-control-color');

        function applyControlValues() {
            const s = flyerState[elSelect.value];
            const isPhoto = elSelect.value === 'photo';
            sizeSlider.disabled = isPhoto;
            colorInput.disabled = isPhoto;
            sizeSlider.value = isPhoto ? 30 : s.size;
            sizeVal.textContent = isPhoto ? '' : s.size;
            colorInput.value = isPhoto ? '#ffffff' : s.color;
        }
        applyControlValues();

        elSelect.addEventListener('change', applyControlValues);

        sizeSlider.addEventListener('input', () => {
            const s = flyerState[elSelect.value];
            if (elSelect.value === 'photo') return;
            s.size = parseInt(sizeSlider.value) || 30;
            sizeVal.textContent = s.size;
            drawMemberFlyer();
        });

        colorInput.addEventListener('input', () => {
            const s = flyerState[elSelect.value];
            if (elSelect.value === 'photo') return;
            s.color = colorInput.value;
            drawMemberFlyer();
        });

        document.getElementById('flyer-new-wish').addEventListener('click', () => {
            flyerState.wishText = getRandomBirthdayWish(m.firstName);
            drawMemberFlyer();
        });

        document.getElementById('flyer-reset-btn').addEventListener('click', () => {
            flyerState.photo = { x: settings.photoX, y: settings.photoY };
            flyerState.name = { x: settings[`nameX${sfx}`], y: settings[`nameY${sfx}`], size: settings[`nameSize${sfx}`], color: settings[`nameColor${sfx}`] };
            flyerState.date = { x: settings[`dateX${sfx}`], y: settings[`dateY${sfx}`], size: settings[`dateSize${sfx}`], color: settings[`dateColor${sfx}`] };
            flyerState.wish = { x: settings[`wishX${sfx}`], y: settings[`wishY${sfx}`], size: settings[`wishSize${sfx}`], color: settings[`wishColor${sfx}`] };
            applyControlValues();
            drawMemberFlyer();
        });
    };

    let flyerState = null;
    let flyerDrag = null;

    function drawMemberFlyer() {
        if (!flyerState) return;
        const canvas = document.getElementById('flyer-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const settings = flyerSettings || DEFAULT_FLYER_SETTINGS;
        const m = flyerState.m;

        ctx.clearRect(0, 0, 1280, 1280);
        if (flyerState.bgReady && !flyerState.bgFailed) {
            ctx.drawImage(flyerState.bgImg, 0, 0, 1280, 1280);
        } else {
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(0, 0, 1280, 1280);
        }

        (async () => {
            if (settings.photoEnabled && flyerState.hasPhoto) {
                await drawPhotoOnFlyer(ctx, m.photo, flyerState.photo.x, flyerState.photo.y, settings.photoBorderSize, settings.photoBorderColor, settings.photoFrameEnabled);
            }
            const n = flyerState.name;
            const d = flyerState.date;
            const w = flyerState.wish;
            drawCustomText(ctx, `${m.firstName} ${m.lastName}`, n.x, n.y, n.size, n.color);
            drawCustomText(ctx, flyerState.dateStr, d.x, d.y, d.size, d.color);
            if (settings.wishEnabled) {
                drawWrappedText(ctx, flyerState.wishText, w.x, w.y, w.size, w.color, 900);
            }
        })();
    }

    function getFlyerCanvasCoords(e) {
        const canvas = document.getElementById('flyer-canvas');
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    function flyerHitTest(cx, cy) {
        if (!flyerState) return null;
        const settings = flyerSettings || DEFAULT_FLYER_SETTINGS;
        const els = [];
        if (settings.photoEnabled && flyerState.hasPhoto) {
            els.push({ name: 'photo', x: flyerState.photo.x, y: flyerState.photo.y, hitR: Math.max(PHOTO_W, PHOTO_H) * 0.5 });
        }
        els.push({ name: 'name', x: flyerState.name.x, y: flyerState.name.y, hitR: Math.max(flyerState.name.size, 30) * 1.2 });
        els.push({ name: 'date', x: flyerState.date.x, y: flyerState.date.y, hitR: Math.max(flyerState.date.size, 24) * 1.2 });
        els.push({ name: 'wish', x: flyerState.wish.x, y: flyerState.wish.y, hitR: Math.max(flyerState.wish.size, 24) * 1.2 });
        for (const el of els) {
            const dist = Math.sqrt((cx - el.x) ** 2 + (cy - el.y) ** 2);
            if (dist < el.hitR) return el.name;
        }
        return null;
    }

    function flyerPointerStart(e) {
        if (!flyerState || flyerDrag) return;
        const modal = document.getElementById('modal-overlay');
        if (modal.classList.contains('hidden')) return;
        const coords = getFlyerCanvasCoords(e);
        if (!coords) return;
        const hit = flyerHitTest(coords.x, coords.y);
        if (hit) {
            flyerDrag = { element: hit, offsetX: coords.x - flyerState[hit].x, offsetY: coords.y - flyerState[hit].y };
            const canvas = document.getElementById('flyer-canvas');
            if (canvas) canvas.style.cursor = 'grabbing';
        }
    }

    function flyerPointerMove(e) {
        if (!flyerDrag) return;
        const coords = getFlyerCanvasCoords(e);
        if (!coords) return;
        const el = flyerState[flyerDrag.element];
        el.x = Math.round(Math.max(0, Math.min(1280, coords.x - flyerDrag.offsetX)));
        el.y = Math.round(Math.max(0, Math.min(1280, coords.y - flyerDrag.offsetY)));
        drawMemberFlyer();
    }

    function flyerPointerEnd() {
        if (flyerDrag) {
            const canvas = document.getElementById('flyer-canvas');
            if (canvas) canvas.style.cursor = 'default';
        }
        flyerDrag = null;
    }

    document.addEventListener('mousedown', flyerPointerStart);
    document.addEventListener('mousemove', flyerPointerMove);
    document.addEventListener('mouseup', flyerPointerEnd);

    document.addEventListener('touchstart', e => {
        const t = e.changedTouches[0];
        flyerPointerStart({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });
    document.addEventListener('touchmove', e => {
        const t = e.changedTouches[0];
        flyerPointerMove({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });
    document.addEventListener('touchend', flyerPointerEnd);

    function getRandomBirthdayWish(firstName) {
        const wish = BIRTHDAY_WISHES[Math.floor(Math.random() * BIRTHDAY_WISHES.length)];
        return wish.replace(/\{name\}/g, firstName || 'there');
    };

    function getOrdinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    window.downloadFlyer = function(name) {
        const canvas = document.getElementById('flyer-canvas');
        const link = document.createElement('a');
        link.download = `birthday_${name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Flyer downloaded!');
    };

    function getWeekRange(offset = 0) {
        const today = new Date();
        const day = today.getDay();
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday + offset * 7);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        return { monday, sunday };
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    function birthdayDateInRange(dob, start, end) {
        if (!dob) return null;
        const b = new Date(dob);
        for (const y of [start.getFullYear(), start.getFullYear() + 1]) {
            let mm = b.getMonth();
            let dd = b.getDate();
            if (mm === 1 && dd === 29 && !isLeapYear(y)) { mm = 2; dd = 1; }
            const d = new Date(y, mm, dd);
            if (d >= start && d <= end) return d;
        }
        return null;
    }

    function formatWeekLabel(monday, sunday) {
        const sameMonth = monday.getMonth() === sunday.getMonth() && monday.getFullYear() === sunday.getFullYear();
        if (sameMonth) {
            return `${monday.toLocaleDateString('en-US', { month: 'short' })} ${monday.getDate()} – ${sunday.getDate()}, ${sunday.getFullYear()}`;
        }
        return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${sunday.getFullYear()}`;
    }

    function loadImage(src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    function drawRoundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function fitText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let t = text;
        while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
            t = t.slice(0, -1);
        }
        return t + '…';
    }

    async function renderBirthdayCalendar() {
        const canvas = document.getElementById('birthday-calendar-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = 1600, H = 900;

        const { monday, sunday } = getWeekRange(calendarWeekOffset);
        const weekLabel = document.getElementById('calendar-week-label');
        if (weekLabel) weekLabel.textContent = formatWeekLabel(monday, sunday);

        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayIdx = (todayStart >= monday && todayStart <= sunday) ? (today.getDay() + 6) % 7 : -1;

        let members = [];
        try {
            const snap = await db.collection('members').get();
            members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
            showToast('Error loading members: ' + err.message, 'error');
        }

        const days = [[], [], [], [], [], [], []];
        for (const m of members) {
            const dayDate = birthdayDateInRange(m.dob, monday, sunday);
            if (!dayDate) continue;
            const idx = Math.round((dayDate - monday) / 86400000);
            if (idx >= 0 && idx < 7) days[idx].push({ m, dayDate });
        }
        for (const arr of days) {
            arr.sort((a, b) => `${a.m.firstName} ${a.m.lastName}`.localeCompare(`${b.m.firstName} ${b.m.lastName}`));
        }

        // Background
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#16213E');
        bg.addColorStop(1, '#0F0F24');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W / 2, 260, 10, W / 2, 260, 700);
        glow.addColorStop(0, 'rgba(255,107,53,0.18)');
        glow.addColorStop(1, 'rgba(255,107,53,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // Logo
        const logo = await loadImage('Ignite chapel no bg.png');
        if (logo) {
            const ls = 140;
            ctx.drawImage(logo, W / 2 - ls / 2, 36, ls, ls);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 60px Arial, sans-serif';
        ctx.fillText('IGNITE CHAPEL', W / 2, 245);

        ctx.fillStyle = '#FFD60A';
        ctx.font = '700 28px Arial, sans-serif';
        ctx.fillText('WEEKLY BIRTHDAY CALENDAR', W / 2, 292);

        // Week range pill
        const rangeText = formatWeekLabel(monday, sunday);
        ctx.font = '600 24px Arial, sans-serif';
        const rw = ctx.measureText(rangeText).width + 64;
        drawRoundRect(ctx, W / 2 - rw / 2, 314, rw, 48, 24);
        ctx.fillStyle = 'rgba(255,107,53,0.22)';
        ctx.fill();
        ctx.strokeStyle = '#FF6B35';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(rangeText, W / 2, 347);

        // Grid
        const colCount = 7;
        const pad = 44;
        const gap = 12;
        const colW = (W - pad * 2 - gap * (colCount - 1)) / colCount;
        const gridTop = 396;
        const gridH = H - gridTop - 136;
        const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

        for (let i = 0; i < colCount; i++) {
            const x = pad + i * (colW + gap);

            drawRoundRect(ctx, x, gridTop, colW, gridH, 16);
            ctx.fillStyle = 'rgba(22, 33, 62, 0.92)';
            ctx.fill();
            if (i === todayIdx) {
                ctx.strokeStyle = '#FFD60A';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            const dayDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
            const hx = x + 8;
            const hw = colW - 16;
            const hy = gridTop + 10;
            const hh = 72;

            drawRoundRect(ctx, hx, hy, hw, hh, 12);
            ctx.fillStyle = i === todayIdx ? '#FFD60A' : 'rgba(255, 107, 53, 0.92)';
            ctx.fill();

            ctx.fillStyle = i === todayIdx ? '#14143C' : '#FFFFFF';
            ctx.font = '700 20px Arial, sans-serif';
            ctx.fillText(dayLabels[i], x + colW / 2, hy + 28);
            ctx.font = '800 28px Arial, sans-serif';
            ctx.fillText(String(dayDate.getDate()), x + colW / 2, hy + 58);

            const list = days[i];
            let ty = hy + hh + 26;
            if (list.length === 0) {
                ctx.fillStyle = '#6B7280';
                ctx.font = '600 18px Arial, sans-serif';
                ctx.fillText('—', x + colW / 2, ty + 8);
            } else {
                const MAX_SHOW = 4;
                list.slice(0, MAX_SHOW).forEach(item => {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '700 18px Arial, sans-serif';
                    const name = fitText(ctx, `${item.m.firstName} ${item.m.lastName}`, colW - 20);
                    ctx.fillText(name, x + colW / 2, ty + 10);
                    ty += 26;
                });
                if (list.length > MAX_SHOW) {
                    ctx.fillStyle = '#B8C1D8';
                    ctx.font = '700 16px Arial, sans-serif';
                    ctx.fillText(`+${list.length - MAX_SHOW} more`, x + colW / 2, ty + 8);
                }
            }
        }

        // Footer
        ctx.fillStyle = '#B8C1D8';
        ctx.font = '600 23px Arial, sans-serif';
        ctx.fillText('🎉 Happy Birthday to our members this week! Let\'s celebrate together 🎉', W / 2, H - 66);
        ctx.fillStyle = '#6B7280';
        ctx.font = '500 17px Arial, sans-serif';
        ctx.fillText('Ignite Chapel', W / 2, H - 38);
    }

    function downloadBirthdayCalendar() {
        const canvas = document.getElementById('birthday-calendar-canvas');
        if (!canvas) return;
        const { monday, sunday } = getWeekRange(calendarWeekOffset);
        const toDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const link = document.createElement('a');
        link.download = `ignite-birthday-calendar_${toDate(monday)}_to_${toDate(sunday)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Calendar downloaded!');
    }

    // ─── User Management ──────────────────────────────────────────────
    async function loadUserManagement() {
        if (!isSuperAdmin()) return;
        const container = document.getElementById('user-management-list');
        if (!container) return;
        try {
            const snap = await db.collection('users').get();
            if (snap.empty) { container.innerHTML = '<p class="empty-state">No users found.</p>'; return; }
            let html = '<table class="user-table"><thead><tr><th>Email</th><th>Role</th><th>Permissions</th><th>Actions</th></tr></thead><tbody>';
            snap.forEach(doc => {
                const u = doc.data();
                const uid = doc.id;
                const isMe = currentUser && uid === currentUser.uid;
                const isTargetSuperAdmin = u.role === 'superadmin';
                const roleBadge = isTargetSuperAdmin ? '<span class="role-badge superadmin">Super Admin</span>' : '<span class="role-badge admin">Admin</span>';
                const perms = (u.permissions || []).map(p => `<span class="perm-badge">${PERMISSION_LABELS[p] || p}</span>`).join(' ');
                html += `<tr>
                    <td>${u.email || '—'}${isMe ? ' <small>(you)</small>' : ''}</td>
                    <td>${roleBadge}</td>
                    <td class="perm-cell">${perms || '—'}</td>
                    <td class="actions-cell">
                        ${!isTargetSuperAdmin ? `<button class="btn btn-sm" onclick="openEditUserPermissions('${uid}', '${u.email}')">Edit</button>` : ''}
                        ${!isTargetSuperAdmin && !isMe ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${uid}', '${u.email}')">Remove</button>` : ''}
                    </td>
                </tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<p class="empty-state">Error loading users.</p>';
            console.error('loadUserManagement error:', err);
        }
    }
    window.loadUserManagement = loadUserManagement;

    function openCreateUserModal() {
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        title.textContent = 'Create New Admin';
        body.innerHTML = `
            <form id="create-user-form" class="user-form">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="new-user-email" placeholder="user@example.com" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="new-user-password" placeholder="Minimum 6 characters" required minlength="6">
                </div>
                <div class="form-group">
                    <label>Display Name</label>
                    <input type="text" id="new-user-display-name" placeholder="Optional">
                </div>
                <div class="form-group">
                    <label>Permissions</label>
                    <div class="permission-toggles">
                        ${ALL_PERMISSIONS.filter(p => p !== 'user-management').map(p => `
                            <label class="perm-toggle">
                                <input type="checkbox" value="${p}"> ${PERMISSION_LABELS[p]}
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div id="create-user-error" class="form-error"></div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Create Admin</button>
                    <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `;
        modal.classList.remove('hidden');
        document.getElementById('create-user-form').addEventListener('submit', createUser);
    }
    window.openCreateUserModal = openCreateUserModal;

    async function createUser(e) {
        e.preventDefault();
        const email = document.getElementById('new-user-email').value.trim();
        const password = document.getElementById('new-user-password').value;
        const displayName = document.getElementById('new-user-display-name').value.trim();
        const errorEl = document.getElementById('create-user-error');
        const perms = Array.from(document.querySelectorAll('#create-user-form .permission-toggles input:checked')).map(cb => cb.value);
        errorEl.textContent = '';
        if (!email || !password) { errorEl.textContent = 'Email and password are required.'; return; }
        errorEl.textContent = 'Creating user...';
        try {
            const res = await fetch('http://localhost:3001/createAdmin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, displayName, permissions: perms })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to create user');
            await loadUserManagement();
            showToast(`Admin "${email}" created successfully!`);
            closeModal();
        } catch (err) {
            if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                errorEl.textContent = 'Admin server not running. Start it with: node admin-server.mjs';
            } else {
                errorEl.textContent = err.message;
            }
            console.error('createUser error:', err);
        }
    }
    window.createUser = createUser;

    function openEditUserPermissions(uid, email) {
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        title.textContent = `Edit Permissions — ${email}`;
        db.collection('users').doc(uid).get().then(doc => {
            if (!doc.exists) { showToast('User not found.', 'error'); return; }
            const u = doc.data();
            const currentPerms = u.permissions || [];
            body.innerHTML = `
                <form id="edit-perms-form" class="user-form">
                    <div class="form-group">
                        <label>Permissions</label>
                        <div class="permission-toggles">
                            ${ALL_PERMISSIONS.filter(p => p !== 'user-management').map(p => `
                                <label class="perm-toggle">
                                    <input type="checkbox" value="${p}" ${currentPerms.includes(p) ? 'checked' : ''}> ${PERMISSION_LABELS[p]}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div id="edit-perms-error" class="form-error"></div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Save</button>
                        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                    </div>
                </form>
            `;
            modal.classList.remove('hidden');
            document.getElementById('edit-perms-form').addEventListener('submit', async ev => {
                ev.preventDefault();
                const perms = Array.from(document.querySelectorAll('#edit-perms-form .permission-toggles input:checked')).map(cb => cb.value);
                try {
                    await db.collection('users').doc(uid).update({ permissions: perms });
                    showToast('Permissions updated!');
                    closeModal();
                    await loadUserManagement();
                } catch (err) {
                    document.getElementById('edit-perms-error').textContent = err.message;
                }
            });
        });
    }
    window.openEditUserPermissions = openEditUserPermissions;

    async function deleteUser(uid, email) {
        if (!confirm(`Remove admin access for "${email}"? This will sign them out on next page reload.`)) return;
        try {
            await db.collection('users').doc(uid).delete();
            showToast(`"${email}" removed from admin list.`);
            await loadUserManagement();
        } catch (err) {
            showToast('Error removing user: ' + err.message, 'error');
            console.error('deleteUser error:', err);
        }
    }
    window.deleteUser = deleteUser;
});
