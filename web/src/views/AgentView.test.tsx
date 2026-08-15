import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentView } from './AgentView';
import { ApiError } from '../api/client';

describe('AgentView', () => {
  it('stores a package and shows the assigned locker and pickup code', async () => {
    const onStore = vi
      .fn()
      .mockResolvedValue({ lockerId: 'M-1', pickupCode: 'ABC234', packageId: 'pkg-1' });
    const user = userEvent.setup();
    render(<AgentView onStore={onStore} />);

    await user.selectOptions(screen.getByLabelText(/package size/i), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: /store package/i }));

    expect(onStore).toHaveBeenCalledWith('MEDIUM');
    expect(await screen.findByText('M-1')).toBeInTheDocument();
    expect(screen.getByText('ABC234')).toBeInTheDocument();
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
