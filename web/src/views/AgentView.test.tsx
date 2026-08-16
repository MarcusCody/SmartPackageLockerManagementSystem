import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentView } from './AgentView';
import { ApiError } from '../api/client';

const storeResult = (overrides: Record<string, unknown> = {}) => ({
  lockerId: 'M-1',
  pickupCode: '042731',
  packageId: 'pkg-1',
  notification: 'none' as const,
  ...overrides,
});

describe('AgentView', () => {
  it('stores a package and shows the assigned locker and pickup code', async () => {
    const onStore = vi.fn().mockResolvedValue(storeResult());
    const user = userEvent.setup();
    render(<AgentView onStore={onStore} />);

    await user.selectOptions(screen.getByLabelText(/package size/i), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: /store package/i }));

    expect(onStore).toHaveBeenCalledWith('MEDIUM', undefined);
    expect(await screen.findByText('M-1')).toBeInTheDocument();
    expect(screen.getByText('042731')).toBeInTheDocument();
  });

  it('emails the PIN when a customer email is entered and confirms it', async () => {
    const onStore = vi.fn().mockResolvedValue(storeResult({ notification: 'sent' }));
    const user = userEvent.setup();
    render(<AgentView onStore={onStore} />);

    await user.type(screen.getByLabelText(/customer email/i), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: /store package/i }));

    expect(onStore).toHaveBeenCalledWith('SMALL', 'jane@example.com');
    expect(await screen.findByText(/pin sent to jane@example.com/i)).toBeInTheDocument();
  });

  it('warns the agent to share the PIN manually when the email fails', async () => {
    const onStore = vi.fn().mockResolvedValue(storeResult({ notification: 'failed' }));
    const user = userEvent.setup();
    render(<AgentView onStore={onStore} />);

    await user.type(screen.getByLabelText(/customer email/i), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: /store package/i }));

    expect(await screen.findByText(/share the pin with the customer manually/i)).toBeInTheDocument();
  });

  it('tells the agent when no suitable locker is available', async () => {
    const onStore = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          'NO_SUITABLE_LOCKER',
          'No suitable locker is available for a LARGE package. The package cannot be stored.',
          409,
        ),
      );
    const user = userEvent.setup();
    render(<AgentView onStore={onStore} />);

    await user.selectOptions(screen.getByLabelText(/package size/i), 'LARGE');
    await user.click(screen.getByRole('button', { name: /store package/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be stored/i);
  });
});
