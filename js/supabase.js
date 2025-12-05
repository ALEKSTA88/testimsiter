// Конфигурация Supabase
const SUPABASE_URL = 'https://mhvqwyugfdvrabymgpvk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odnF3eXVnZmR2cmFieW1ncHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTk2NTQsImV4cCI6MjA4MDUzNTY1NH0.v6Qm3A0RB5mdL8_QA64mdfJhKQOyDC5KrZMzxrFx3Hc';

// Инициализация Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Проверка аутентификации
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Получение текущего пользователя
async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Регистрация
async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: username
            }
        }
    });
    
    if (error) throw error;
    return data;
}

// Вход
async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) throw error;
    return data;
}

// Выход
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// Создание скрипта
async function createSnippet(snippetData) {
    const user = await getCurrentUser();
    
    const snippet = {
        title: snippetData.title,
        description: snippetData.description,
        code: snippetData.code,
        language: snippetData.language,
        visibility: snippetData.visibility,
        tags: snippetData.tags,
        user_id: user.id,
        views: 0,
        created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
        .from('snippets')
        .insert([snippet])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

// Получение скриптов
async function getSnippets(limit = 20, page = 1) {
    const { data, error } = await supabase
        .from('snippets')
        .select('*, user:users(username)')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
    
    if (error) throw error;
    return data;
}

// Получение скрипта по ID
async function getSnippetById(id) {
    // Увеличиваем счетчик просмотров
    await supabase
        .from('snippets')
        .update({ views: supabase.raw('views + 1') })
        .eq('id', id);
    
    const { data, error } = await supabase
        .from('snippets')
        .select('*, user:users(username, avatar_url)')
        .eq('id', id)
        .single();
    
    if (error) throw error;
    return data;
}

// Получение статистики
async function getStats() {
    const { count: snippetsCount } = await supabase
        .from('snippets')
        .select('*', { count: 'exact', head: true })
        .eq('visibility', 'public');
    
    const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
    
    return {
        snippets: snippetsCount || 0,
        users: usersCount || 0
    };
}

// Поиск скриптов
async function searchSnippets(query, language = null) {
    let queryBuilder = supabase
        .from('snippets')
        .select('*, user:users(username)')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,code.ilike.%${query}%`)
        .eq('visibility', 'public');
    
    if (language) {
        queryBuilder = queryBuilder.eq('language', language);
    }
    
    const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (error) throw error;
    return data;
}

export {
    supabase,
    checkAuth,
    getCurrentUser,
    signUp,
    signIn,
    signOut,
    createSnippet,
    getSnippets,
    getSnippetById,
    getStats,
    searchSnippets
};