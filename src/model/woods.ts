import type { Project, Wood } from './types'

const LUMBER_LENGTHS = [96, 120, 144]

function lumber(id: string, thickness: number, width: number): Wood {
  return { id, name: id, kind: 'lumber', species: 'Pine', thickness, width, length: 144, availableLengths: [...LUMBER_LENGTHS], builtIn: true }
}

function hardwood(id: string, name: string, thickness: number): Wood {
  return { id, name, kind: 'hardwood', species: 'Hardwood', thickness, width: 12, length: 144, builtIn: true }
}

function sheet(id: string, name: string, species: string, thickness: number): Wood {
  return { id, name, kind: 'sheet', species, thickness, width: 48, length: 96, builtIn: true }
}

/** The wood library that ships with the app, at actual (not nominal) sizes. */
export const BUILTIN_WOODS: readonly Wood[] = Object.freeze([
  lumber('1x2', 0.75, 1.5),
  lumber('1x3', 0.75, 2.5),
  lumber('1x4', 0.75, 3.5),
  lumber('1x6', 0.75, 5.5),
  lumber('1x8', 0.75, 7.25),
  lumber('1x10', 0.75, 9.25),
  lumber('1x12', 0.75, 11.25),
  lumber('2x2', 1.5, 1.5),
  lumber('2x4', 1.5, 3.5),
  lumber('2x6', 1.5, 5.5),
  hardwood('hw-4-4', 'Hardwood 4/4', 0.75),
  hardwood('hw-5-4', 'Hardwood 5/4', 1.0),
  hardwood('hw-8-4', 'Hardwood 8/4', 1.75),
  sheet('ply-1-4', '1/4" Plywood', 'Plywood', 0.21875),
  sheet('ply-1-2', '1/2" Plywood', 'Plywood', 0.46875),
  sheet('ply-3-4', '3/4" Plywood', 'Plywood', 0.71875),
  sheet('mdf-1-2', '1/2" MDF', 'MDF', 0.5),
  sheet('mdf-3-4', '3/4" MDF', 'MDF', 0.75)
])

export function cloneWoods(woods: readonly Wood[]): Wood[] {
  return woods.map(w => ({ ...w, availableLengths: w.availableLengths ? [...w.availableLengths] : undefined }))
}

export function findWood(project: Project, id: string): Wood | undefined {
  return project.woods.find(w => w.id === id)
}

/** Board feet from inches: T x W x L / 144. */
export function boardFeet(t: number, w: number, l: number): number {
  return (t * w * l) / 144
}

export function emptyProject(name: string, extraWoods: readonly Wood[] = []): Project {
  return { formatVersion: 9, name, units: 'in', boards: [], joints: [], woods: cloneWoods([...BUILTIN_WOODS, ...extraWoods]), sketches: [] }
}
