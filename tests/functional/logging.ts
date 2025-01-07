import { projectLogger, createModuleLogger } from '../../src/logger';

export const log = createModuleLogger(projectLogger, 'tests');
