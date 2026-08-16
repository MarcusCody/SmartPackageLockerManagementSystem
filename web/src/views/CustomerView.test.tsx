import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerView } from './CustomerView';
import { ApiError } from '../api/client';

const pickupResult = (overrides: Record<string, unknown> = {}) => ({
  opened: true,
  lockerId: 'S-1',
  package: { id: 'pkg-1', size: 'SMALL' as const },
  storedAt: '2026-08-15T10:00:00.000Z',
  retrievedAt: '2026-08-17T10:00:00.000Z',
  storageCharge: 20,
  ...overrides,
});

describe('CustomerView', () => {
  it('collects a package with the PIN alone and shows which locker opened', async () => {
    const onRetrieve = vi.fn().mockResolvedValue(pickupResult());
    const user = userEvent.setup();
    render(<CustomerView onRetrieve={onRetrieve} />);

    await user.type(screen.getByLabelText(/pickup code/i), '042731');
    await user.click(screen.getByRole('button', { name: /open locker/i }));

    expect(onRetrieve).toHaveBeenCalledWith('042731', undefined);
    expect(await screen.findByRole('status')).toHaveTextContent(/locker s-1 is open/i);
    expect(screen.getByText('RM20')).toBeInTheDocument();
  });

  it('passes the locker id through when the customer provides one', async () => {
    const onRetrieve = vi.fn().mockResolvedValue(pickupResult());
    const user = userEvent.setup();
    render(<CustomerView onRetrieve={onRetrieve} />);

    await user.type(screen.getByLabelText(/pickup code/i), '042731');
    await user.type(screen.getByLabelText(/locker id/i), 's-1');
    await user.click(screen.getByRole('button', { name: /open locker/i }));

    expect(onRetrieve).toHaveBeenCalledWith('042731', 'S-1');
  });

  it('shows a free pickup when the package is collected within the grace period', async () => {
    const onRetrieve = vi.fn().mockResolvedValue(pickupResult({ storageCharge: 0 }));
    const user = userEvent.setup();
    render(<CustomerView onRetrieve={onRetrieve} />);

    await user.type(screen.getByLabelText(/pickup code/i), '042731');
    await user.click(screen.getByRole('button', { name: /open locker/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/free/i);
  });

  it('explains a wrong pickup code in friendly language', async () => {
    const onRetrieve = vi
      .fn()
      .mockRejectedValue(
        new ApiError('INVALID_PICKUP_CODE', 'The pickup code does not match any stored package.', 422),
      );
    const user = userEvent.setup();
    render(<CustomerView onRetrieve={onRetrieve} />);

    await user.type(screen.getByLabelText(/pickup code/i), '999999');
    await user.click(screen.getByRole('button', { name: /open locker/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/doesn't match/i);
  });

  it('explains an empty locker in friendly language', async () => {
    const onRetrieve = vi
      .fn()
      .mockRejectedValue(
        new ApiError('LOCKER_EMPTY', 'Locker S-1 has no package to retrieve.', 422),
      );
    const user = userEvent.setup();
    render(<CustomerView onRetrieve={onRetrieve} />);

    await user.type(screen.getByLabelText(/pickup code/i), '042731');
    await user.type(screen.getByLabelText(/locker id/i), 'S-1');
    await user.click(screen.getByRole('button', { name: /open locker/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already been collected/i);
  });
});
