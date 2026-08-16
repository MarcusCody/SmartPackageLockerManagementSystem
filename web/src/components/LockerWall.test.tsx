import { render, screen } from '@testing-library/react';
import { LockerWall } from './LockerWall';
import type { LockerView } from '../api/client';

const lockers: LockerView[] = [
  { id: 'S-1', size: 'SMALL', available: false },
  { id: 'M-1', size: 'MEDIUM', available: true },
  { id: 'L-1', size: 'LARGE', available: true },
];

describe('LockerWall', () => {
  it('renders one door per locker with its size and occupancy', () => {
    render(<LockerWall lockers={lockers} />);

    expect(screen.getByRole('img', { name: /locker s-1, small, occupied/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /locker m-1, medium, available/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /locker l-1, large, available/i })).toBeInTheDocument();
  });
});
