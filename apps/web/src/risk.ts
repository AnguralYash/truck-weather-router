import type { RiskName } from './types'

export interface RiskStyle {
  name: RiskName
  level: number
  label: string
  color: string
}

export const RISK_LEVELS: readonly RiskStyle[] = [
  { name: 'LOW', level: 1, label: 'Low', color: '#2f9e44' },
  { name: 'MODERATE', level: 2, label: 'Moderate', color: '#f2c200' },
  { name: 'HIGH', level: 3, label: 'High', color: '#f08c00' },
  { name: 'SEVERE', level: 4, label: 'Severe', color: '#e03131' },
  { name: 'NO_TRAVEL', level: 5, label: 'No Travel', color: '#5c0f3c' },
]

export const riskByName = (name: RiskName): RiskStyle =>
  RISK_LEVELS.find((risk) => risk.name === name) ?? RISK_LEVELS[0]

/** Distinct from every risk color, so a route is never mistaken for a risk. */
export const ROUTE_COLORS = ['#1c7ed6', '#7048e8', '#495057'] as const

/** Routes keep the color and name of their original order, whatever their rank. */
export const routeNumber = (routeId: string) => Number(routeId.split('-')[1])

export const routeColor = (routeId: string) =>
  ROUTE_COLORS[(routeNumber(routeId) - 1) % ROUTE_COLORS.length]
