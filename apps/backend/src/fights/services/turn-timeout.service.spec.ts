import { Logger } from '@nestjs/common';
import { TurnTimeoutService } from './turn-timeout.service';

describe('TurnTimeoutService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should call onTimeout after the turn delay', async () => {
    const onTimeout = jest.fn();
    const service = new TurnTimeoutService();
    service.schedule(7, onTimeout);

    await jest.advanceTimersByTimeAsync(90_000);

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(service.has(7)).toBe(false);
  });

  it('should replace the previous countdown when rescheduled', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const service = new TurnTimeoutService();
    service.schedule(7, first);
    await jest.advanceTimersByTimeAsync(60_000);
    service.schedule(7, second);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(30_000);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('should log a failing onTimeout instead of leaving an unhandled rejection', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    new TurnTimeoutService().schedule(7, () =>
      Promise.reject(new Error('boom')),
    );

    await jest.advanceTimersByTimeAsync(90_000);

    expect(error).toHaveBeenCalledWith(
      'Timeout du match 7 en échec',
      expect.stringContaining('boom'),
    );
  });
});
