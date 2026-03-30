import request from '@/utils/request'

export const authApi = {
  login: (username: string, password: string) =>
    request.post('/auth/login', { username, password }),
  logout: () => request.post('/auth/logout'),
  profile: () => request.get('/auth/profile'),
}
