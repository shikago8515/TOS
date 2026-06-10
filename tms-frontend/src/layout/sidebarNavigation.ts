export interface SidebarParentChildModule {
  path: string
  routeName: string
}

export interface SidebarParentActivationInput {
  parentId: string
  childModules: readonly SidebarParentChildModule[]
  activeRouteName: unknown
  expandedParentIds: ReadonlySet<string>
}

export interface SidebarParentActivation {
  expandedParentIds: Set<string>
  targetPath?: string
}

export function resolveSidebarParentActivation({
  parentId,
  childModules,
  activeRouteName,
  expandedParentIds,
}: SidebarParentActivationInput): SidebarParentActivation {
  const nextExpanded = new Set(expandedParentIds)
  const hasActiveChild = childModules.some((module) => module.routeName === activeRouteName)

  if (hasActiveChild) {
    if (nextExpanded.has(parentId)) {
      nextExpanded.delete(parentId)
    } else {
      nextExpanded.add(parentId)
    }

    return { expandedParentIds: nextExpanded }
  }

  nextExpanded.add(parentId)

  return {
    expandedParentIds: nextExpanded,
    targetPath: childModules[0]?.path,
  }
}
