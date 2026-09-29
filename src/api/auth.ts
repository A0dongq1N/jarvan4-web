import request from '@/utils/request'

export const authApi = {
  logout: () => request.post('/auth/logout'),
}
