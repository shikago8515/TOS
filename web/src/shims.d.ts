/// <reference types="vite/client" />
/// <reference types="vue/macros-global" />

declare module '*.vue' {
	import type { DefineComponent } from 'vue'
	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
	export default component
}

declare module '@/api/teacher/case' {
	export function getTeacherCaseList(...args: any[]): Promise<any>
	export function deleteCase(...args: any[]): Promise<any>
	export function batchPublishCases(...args: any[]): Promise<any>
	export function withdrawCase(...args: any[]): Promise<any>
	export function batchWithdrawCases(...args: any[]): Promise<any>
	export function getCaseDetail(...args: any[]): Promise<any>
	export function updateCase(...args: any[]): Promise<any>
}

declare module '@/api/teacher/task' {
	export function getTasksByCaseId(...args: any[]): Promise<any>
}
