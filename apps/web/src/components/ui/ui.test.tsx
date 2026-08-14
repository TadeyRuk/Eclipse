import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';
import { Tag } from './Tag';
import { Button } from './Button';
import { Pill } from './Pill';
import { StatChip } from './StatChip';
import { GradientField } from './GradientField';
import { Users } from 'lucide-react';

describe('Card', () => {
  it('renders children and forwards testId as data-testid', () => {
    render(<Card testId="my-card">hello</Card>);
    expect(screen.getByTestId('my-card')).toHaveTextContent('hello');
  });

  it('merges extra className', () => {
    render(
      <Card testId="my-card" className="extra-class">
        x
      </Card>,
    );
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

describe('Button', () => {
  it('renders children and forwards testId, onClick, disabled', async () => {
    let clicked = false;
    render(
      <Button testId="my-btn" onClick={() => (clicked = true)}>
        Click me
      </Button>,
    );
    const btn = screen.getByTestId('my-btn');
    expect(btn).toHaveTextContent('Click me');
    btn.click();
    expect(clicked).toBe(true);
  });

  it('applies disabled attribute', () => {
    render(
      <Button testId="my-btn" disabled>
        x
      </Button>,
    );
    expect(screen.getByTestId('my-btn')).toBeDisabled();
  });

  it('defaults to primary variant classes', () => {
    render(<Button testId="my-btn">x</Button>);
    expect(screen.getByTestId('my-btn').className).toContain('bg-[var(--eclipse-accent)]');
  });
});

describe('Pill', () => {
  it('renders children', () => {
    render(<Pill>Employer</Pill>);
    expect(screen.getByText('Employer')).toBeInTheDocument();
  });
});

describe('StatChip', () => {
  it('renders icon, value and label', () => {
    render(<StatChip icon={Users} label="Recipients" value={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Recipients')).toBeInTheDocument();
  });
});

describe('GradientField', () => {
  it('renders children', () => {
    render(
      <GradientField>
        <p>content</p>
      </GradientField>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
