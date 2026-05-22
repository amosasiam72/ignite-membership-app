document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let flyerSettings = null;

    const DEFAULT_FLYER_SETTINGS = {
        photoEnabled: true,
        photoX: 640,
        photoY: 420,
        photoSize: 300,
        photoBorderSize: 0,
        photoBorderColor: '#ffffff',
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
        templateImage: null,
        templateImageNoPhoto: null
    };

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

        const nameEnabled = document.getElementById('settings-name-enabled').checked;
        const dateEnabled = document.getElementById('settings-date-enabled').checked;
        
        const templateSrc = editorMode === 'nophoto'
            ? (flyerSettings && flyerSettings.templateImageNoPhoto ? flyerSettings.templateImageNoPhoto : FLYER_TEMPLATE)
            : (flyerSettings && flyerSettings.templateImage ? flyerSettings.templateImage : FLYER_TEMPLATE);
        
        const render = async () => {
            ctx.clearRect(0, 0, 1280, 1280);
            ctx.drawImage(previewTemplateImage, 0, 0, 1280, 1280);
            
            if (photoEnabled) {
                await drawPhotoPlaceholder(ctx, photoX, photoY, photoBorderSize, photoBorderColor);
            }
            
            if (nameEnabled) {
                drawCustomText(ctx, "John Doe", nameX, nameY, nameSize, nameColor);
            }
            if (dateEnabled) {
                drawCustomText(ctx, "21st May", dateX, dateY, dateSize, dateColor);
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

    const PHOTO_W = 376, PHOTO_H = 567;

    function drawPhotoOnFlyer(ctx, src, x, y, borderSize = 0, borderColor = '#ffffff') {
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
                resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
        });
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
        ['photo', 'name', 'date'].forEach(el => {
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
        for (const el of elements) {
            const dist = Math.sqrt((cx - el.x) ** 2 + (cy - el.y) ** 2);
            if (dist < el.hitR) return el.name;
        }
        return null;
    }

    // Drag-and-drop on canvas
    document.addEventListener('mousedown', e => {
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
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging || !selectedElement) return;
        const coords = getCanvasCoords(e);
        const hiddenX = document.getElementById(`settings-${selectedElement}-x`);
        const hiddenY = document.getElementById(`settings-${selectedElement}-y`);
        if (hiddenX && hiddenY) {
            hiddenX.value = Math.round(Math.max(0, Math.min(1280, coords.x - dragOffsetX)));
            hiddenY.value = Math.round(Math.max(0, Math.min(1280, coords.y - dragOffsetY)));
            drawSettingsPreview();
        }
    });

    document.addEventListener('mouseup', () => {
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
    });

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
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                role: 'admin',
                displayName: user.email.split('@')[0],
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            });
        } else {
            await db.collection('users').doc(user.uid).update({
                lastLogin: new Date().toISOString()
            });
        }
    }

    // Fallback: hide loading screen after 3s regardless of auth state
    setTimeout(() => {
        const loading = document.getElementById('loading-screen');
        if (loading && !loading.classList.contains('hidden')) {
            loading.classList.add('hidden');
        }
    }, 3000);

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
            try {
                await loadFlyerSettings();
                await loadDashboard();
            } catch (err) {
                console.error('Dashboard load error:', err);
            }
        } else {
            currentUser = null;
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

    document.getElementById('add-member-btn').addEventListener('click', () => showMemberForm());
    document.getElementById('add-event-btn').addEventListener('click', () => showEventForm());
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('member-search').addEventListener('input', e => {
        loadMembers(e.target.value);
    });

    document.getElementById('current-year').textContent = new Date().getFullYear();

    window.showToast = showToast;
    window.navigate = navigateTo;

    async function navigateTo(page, data = {}) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

        const navLink = document.querySelector(`.nav-links a[data-page="${page}"]`);
        if (navLink) navLink.classList.add('active');

        switch (page) {
            case 'dashboard':
                document.getElementById('page-dashboard').classList.add('active');
                loadDashboard();
                break;
            case 'members':
                document.getElementById('page-members').classList.add('active');
                loadMembers();
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
            .filter(m => m.dob && daysUntilBirthday(m.dob) > 0)
            .sort((a, b) => daysUntilBirthday(a.dob) - daysUntilBirthday(b.dob))
            .slice(0, 15);

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
                <div class="flyer-actions">
                    <button class="btn btn-primary btn-lg" onclick="downloadFlyer('${m.firstName}_${m.lastName}')">Download PNG</button>
                    <button class="btn" onclick="closeModal()">Close</button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');

        const canvas = document.getElementById('flyer-canvas');
        const ctx = canvas.getContext('2d');

        const dobDate = new Date(m.dob);
        const dateStr = `${dobDate.getDate()}${getOrdinal(dobDate.getDate())} ${dobDate.toLocaleDateString('en-US', { month: 'long' })} ${new Date().getFullYear()}`;

        const settings = flyerSettings || DEFAULT_FLYER_SETTINGS;
        const hasPhoto = !!m.photo;
        const sfx = hasPhoto ? '' : 'NoPhoto';
        const templateSrc = hasPhoto
            ? (settings.templateImage || FLYER_TEMPLATE)
            : (settings.templateImageNoPhoto || FLYER_TEMPLATE);

        const bgImg = new Image();
        bgImg.onload = async () => {
            ctx.drawImage(bgImg, 0, 0, 1280, 1280);

            if (settings.photoEnabled && hasPhoto) {
                await drawPhotoOnFlyer(ctx, m.photo, settings.photoX, settings.photoY, settings.photoBorderSize, settings.photoBorderColor);
            }

            drawCustomText(ctx, `${m.firstName} ${m.lastName}`, settings[`nameX${sfx}`], settings[`nameY${sfx}`], settings[`nameSize${sfx}`], settings[`nameColor${sfx}`]);
            drawCustomText(ctx, dateStr, settings[`dateX${sfx}`], settings[`dateY${sfx}`], settings[`dateSize${sfx}`], settings[`dateColor${sfx}`]);
        };
        bgImg.onerror = async () => {
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(0, 0, 1280, 1280);

            if (settings.photoEnabled && hasPhoto) {
                await drawPhotoOnFlyer(ctx, m.photo, settings.photoX, settings.photoY, settings.photoBorderSize, settings.photoBorderColor);
            }

            drawCustomText(ctx, `${m.firstName} ${m.lastName}`, settings[`nameX${sfx}`], settings[`nameY${sfx}`], settings[`nameSize${sfx}`], settings[`nameColor${sfx}`]);
            drawCustomText(ctx, dateStr, settings[`dateX${sfx}`], settings[`dateY${sfx}`], settings[`dateSize${sfx}`], settings[`dateColor${sfx}`]);
        };
        bgImg.src = templateSrc;
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
});
