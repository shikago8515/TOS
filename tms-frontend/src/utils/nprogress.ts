import NProgress from 'nprogress'

NProgress.configure({
  easing: 'ease',
  minimum: 0.08,
  showSpinner: true,
  speed: 500,
  trickleSpeed: 200,
})

export const nprogress = NProgress

