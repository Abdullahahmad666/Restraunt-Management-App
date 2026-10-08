import {AccessibilityInfo} from 'react-native';
import {act, render, screen} from '@testing-library/react-native';

import {TypeOn} from '../src/components/TypeOn';

/** What a sighted reader can actually see: the leading run of characters that
 * are not transparent. The accessibility label is the whole line, so it is
 * also the way to get hold of the outer node rather than the transparent one
 * nested inside it. */
function visibleText(line: string): string {
  const node = screen.getByLabelText(line);
  const parts = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
  const [typed] = parts;
  return typeof typed === 'string' ? typed : '';
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const LINE = 'Staff. Cost.';

describe('typing', () => {
  it('arrives a character at a time and ends with the whole line', async () => {
    await render(<TypeOn text="Staff. Cost." speed={10} />);
    await act(async () => {});

    expect(visibleText(LINE)).toBe('');

    await act(async () => {
      jest.advanceTimersByTime(30);
    });
    expect(visibleText(LINE)).toBe('Sta');

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(visibleText(LINE)).toBe('Staff. Cost.');
  });

  it('holds the full width from the first frame, so nothing reflows', async () => {
    // The untyped remainder is transparent rather than absent. If it were
    // absent the line would grow as it typed, and a centred line would crawl
    // sideways while `adjustsFontSizeToFit` re-decided its size underneath it.
    await render(<TypeOn text="Staff. Cost." speed={10} />);
    await act(async () => {});

    expect(screen.getByText(/Staff\. Cost\./)).toBeTruthy();
  });

  it('waits out its delay before starting, so lines can be staggered', async () => {
    await render(<TypeOn text={LINE} speed={10} delay={200} />);
    await act(async () => {});

    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    expect(visibleText(LINE)).toBe('');

    await act(async () => {
      jest.advanceTimersByTime(80);
    });
    expect(visibleText(LINE)).not.toBe('');
  });

  it('reads out the finished sentence to a screen reader while still typing', async () => {
    await render(<TypeOn text="Staff. Cost." speed={10} />);
    await act(async () => {});

    expect(screen.getByLabelText('Staff. Cost.')).toBeTruthy();
  });
});

describe('when the system asks for less motion', () => {
  it('shows the line immediately instead of typing it', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    await render(<TypeOn text="Staff. Cost." speed={10} />);
    await act(async () => {});

    expect(visibleText(LINE)).toBe('Staff. Cost.');
  });

  it('shows it rather than nothing if the setting cannot be read', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('nope'));

    await render(<TypeOn text="Staff. Cost." speed={10} />);
    await act(async () => {});

    expect(visibleText(LINE)).toBe('Staff. Cost.');
  });
});
