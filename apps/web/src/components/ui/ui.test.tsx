import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';
import { Tag } from './Tag';

describe('Card', () => {
  it('renders children and forwards testId as data-testid', () => {
    render(<Card testId="my-card">hello</Card>);
    expect(screen.getByTestId('my-card')).toHaveTextContent('hello');
  });

  it('merges extra className', () => {
    render(<Card testId="my-card" className="extra-class">x</Card>);
    expect(screen.getByTestId('my-card').className).toContain('extra-class');
  });
});

describe('Tag', () => {
  it('renders children', () => {
    render(<Tag>Claimed</Tag>);
    expect(screen.getByText('Claimed')).toBeInTheDocument();
  });

  it('defaults to the default tone class', () => {
    render(<Tag>Pending</Tag>);
    expect(screen.getByText('Pending').className).toContain('bg-[var(--eclipse-tag-bg)]');
  });
});
