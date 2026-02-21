/**
 * Shared type definitions for dependency bump checking.
 */
import type { DependencyBump } from './changelog';

/**
 * Represents a single dependency version change.
 * This is an alias for DependencyBump — both types are identical.
 */
export type DependencyChange = DependencyBump;
