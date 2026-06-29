import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    keepAliveName?: string
    isAffix?: '0' | '1'
    isKeepAlive?: '0' | '1'
    isVisible?: '0' | '1'
  }
}

export {}
