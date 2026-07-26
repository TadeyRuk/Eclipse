import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library only auto-cleans when vitest runs with `globals: true`, which
// this project does not. Without this, mounted trees leak between tests and any
// two renders sharing a data-testid collide with "found multiple elements".
afterEach(cleanup);
