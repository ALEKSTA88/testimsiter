import { getCurrentUser, supabase, signOut } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Проверить авторизацию
    const user = await getCurrentUser();
    
    if (!user) {
        document.getElementById('authRequired').style.display = 'block';
        return;
    }
    
    document.getElementById('dashboardContent').style.display = 'block';
    
    // Загрузить данные пользователя
    await loadUserData(user);
    await loadUserSnippets(user.id);
    await loadUserStats(user.id);
    
    // Настройка табов
    setupTabs();
    
    // Настройка формы профиля
    setupProfileForm(user);
    
    // Настройка удаления аккаунта
    setupAccountDeletion(user);
});

// Загрузка данных пользователя
async function loadUserData(user) {
    // Загрузить расширенные данные профиля
    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
    
    // Обновить приветствие
    const welcomeMsg = document.getElementById('welcomeMessage');
    if (welcomeMsg) {
        welcomeMsg.textContent = `Привет, ${profile?.username || user.email}!`;
    }
    
    // Обновить аватар
    const avatarPreview = document.getElementById('avatarPreview');
    if (avatarPreview) {
        if (profile?.avatar_url) {
            avatarPreview.innerHTML = `<img src="${profile.avatar_url}" alt="Аватар">`;
        } else {
            const initial = (profile?.username || user.email || 'U').charAt(0).toUpperCase();
            avatarPreview.textContent = initial;
        }
    }
    
    // Заполнить форму профиля
    document.getElementById('username').value = profile?.username || '';
    document.getElementById('bio').value = profile?.bio || '';
    document.getElementById('website').value = profile?.website || '';
}

// Загрузка скриптов пользователя
async function loadUserSnippets(userId) {
    const container = document.getElementById('userSnippets');
    if (!container) return;
    
    try {
        const { data: snippets } = await supabase
            .from('snippets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (!snippets || snippets.length === 0) {
            container.innerHTML = `
                <div class="empty-dashboard">
                    <i class="fas fa-code"></i>
                    <h3>У вас пока нет скриптов</h3>
                    <p>Создайте свой первый скрипт и поделитесь им с миром!</p>
                    <a href="create.html" class="btn btn-primary">Создать скрипт</a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="posts-container">
                ${snippets.map(snippet => `
                    <div class="snippet-card">
                        <div class="snippet-header">
                            <h3>${escapeHtml(snippet.title)}</h3>
                            <span class="language-badge">${snippet.language}</span>
                        </div>
                        
                        <div class="snippet-meta">
                            <span><i class="fas fa-clock"></i> ${formatDate(snippet.created_at)}</span>
                            <span><i class="fas fa-eye"></i> ${snippet.views}</span>
                            <span><i class="fas fa-${snippet.visibility === 'public' ? 'globe' : 'lock'}"></i> ${getVisibilityLabel(snippet.visibility)}</span>
                        </div>
                        
                        <div class="snippet-excerpt">${truncateCode(snippet.code, 150)}</div>
                        
                        <div class="snippet-actions">
                            <a href="view.html?id=${snippet.id}" class="btn btn-secondary btn-icon">
                                <i class="fas fa-eye"></i>
                            </a>
                            <a href="edit.html?id=${snippet.id}" class="btn btn-secondary btn-icon">
                                <i class="fas fa-edit"></i>
                            </a>
                            <button class="btn btn-secondary btn-icon delete-snippet" data-id="${snippet.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Настройка удаления скриптов
        document.querySelectorAll('.delete-snippet').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const snippetId = e.target.closest('button').dataset.id;
                await deleteSnippet(snippetId);
            });
        });
        
    } catch (error) {
        console.error('Ошибка загрузки скриптов:', error);
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка загрузки</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Загрузка статистики пользователя
async function loadUserStats(userId) {
    try {
        // Общее количество скриптов
        const { count: totalSnippets } = await supabase
            .from('snippets')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        
        document.getElementById('totalSnippetsStat').textContent = totalSnippets || 0;
        
        // Общее количество просмотров
        const { data: snippets } = await supabase
            .from('snippets')
            .select('views')
            .eq('user_id', userId);
        
        const totalViews = snippets?.reduce((sum, snippet) => sum + snippet.views, 0) || 0;
        document.getElementById('totalViewsStat').textContent = totalViews.toLocaleString();
        
        // Возраст аккаунта
        const { data: user } = await supabase.auth.getUser();
        if (user?.user?.created_at) {
            const created = new Date(user.user.created_at);
            const now = new Date();
            const diffTime = Math.abs(now - created);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            document.getElementById('accountAgeStat').textContent = diffDays;
        }
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Настройка табов
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Обновить активные табы
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${tabName}Tab`).classList.add('active');
        });
    });
}

// Настройка формы профиля
function setupProfileForm(user) {
    const form = document.getElementById('profileForm');
    const avatarInput = document.getElementById('avatarInput');
    
    if (!form) return;
    
    // Загрузка аватара
    avatarInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Проверка размера (2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Файл слишком большой. Максимальный размер: 2MB');
            return;
        }
        
        try {
            // Загрузка в Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}.${fileExt}`;
            const filePath = `avatars/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });
            
            if (uploadError) throw uploadError;
            
            // Получение публичного URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);
            
            // Обновление профиля
            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);
            
            if (updateError) throw updateError;
            
            // Обновление превью
            const avatarPreview = document.getElementById('avatarPreview');
            avatarPreview.innerHTML = `<img src="${publicUrl}" alt="Аватар">`;
            
            alert('Аватар успешно обновлен!');
            
        } catch (error) {
            console.error('Ошибка загрузки аватара:', error);
            alert('Ошибка при загрузке аватара');
        }
    });
    
    // Сохранение профиля
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const bio = document.getElementById('bio').value;
        const website = document.getElementById('website').value;
        
        const saveBtn = form.querySelector('button[type="submit"]');
        const originalText = saveBtn.innerHTML;
        
        try {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
            saveBtn.disabled = true;
            
            // Проверка username на уникальность
            if (username) {
                const { data: existingUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .neq('id', user.id)
                    .single();
                
                if (existingUser) {
                    throw new Error('Пользователь с таким именем уже существует');
                }
            }
            
            // Обновление профиля
            const { error } = await supabase
                .from('users')
                .update({
                    username: username || null,
                    bio: bio || null,
                    website: website || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);
            
            if (error) throw error;
            
            alert('Профиль успешно обновлен!');
            window.location.reload();
            
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            alert(`Ошибка: ${error.message}`);
            
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    });
}

// Настройка удаления аккаунта
function setupAccountDeletion(user) {
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (!deleteBtn) return;
    
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить. Все ваши данные будут удалены.')) {
            return;
        }
        
        const confirmation = prompt('Для подтверждения введите "DELETE":');
        if (confirmation !== 'DELETE') {
            alert('Удаление отменено');
            return;
        }
        
        try {
            // Удалить все скрипты пользователя
            const { error: snippetsError } = await supabase
                .from('snippets')
                .delete()
                .eq('user_id', user.id);
            
            if (snippetsError) throw snippetsError;
            
            // Удалить профиль пользователя
            const { error: profileError } = await supabase
                .from('users')
                .delete()
                .eq('id', user.id);
            
            if (profileError) throw profileError;
            
            // Удалить пользователя из auth
            const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
            
            if (authError) throw authError;
            
            // Выйти и перенаправить
            await signOut();
            alert('Аккаунт успешно удален');
            window.location.href = 'index.html';
            
        } catch (error) {
            console.error('Ошибка удаления аккаунта:', error);
            alert('Ошибка при удалении аккаунта');
        }
    });
}

// Удаление скрипта
async function deleteSnippet(snippetId) {
    if (!confirm('Вы уверены, что хотите удалить этот скрипт?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('snippets')
            .delete()
            .eq('id', snippetId);
        
        if (error) throw error;
        
        alert('Скрипт успешно удален');
        window.location.reload();
        
    } catch (error) {
        console.error('Ошибка удаления скрипта:', error);
        alert('Ошибка при удалении скрипта');
    }
}

// Вспомогательные функции
function getVisibilityLabel(visibility) {
    const labels = {
        'public': 'Публичный',
        'unlisted': 'Скрытый',
        'private': 'Приватный'
    };
    return labels[visibility] || visibility;
}

function truncateCode(code, maxLength) {
    const cleanCode = code.replace(/\s+/g, ' ').trim();
    if (cleanCode.length <= maxLength) return escapeHtml(cleanCode);
    return escapeHtml(cleanCode.substring(0, maxLength)) + '...';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}