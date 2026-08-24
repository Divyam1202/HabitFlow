import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HabytFlow',
    short_name: 'HabytFlow',
    description: 'Track habits and stay productive',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/hyf-logo-v2-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/hyf-logo-v2-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
    ],
  }
}
