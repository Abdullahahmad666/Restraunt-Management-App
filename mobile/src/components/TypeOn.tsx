import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, StyleSheet, Text, type StyleProp, type TextStyle} from 'react-native';

type Props = {
  text: string;
  /** Milliseconds per character. */
  speed?: number;
  /** How long to wait before the first character, for staggering lines. */
  delay?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  onDone?: () => void;
};

/**
 * Types its text out one character at a time.
 *
 * The whole string is always in the tree - the part not yet typed is simply
 * transparent. That is what keeps it still: the line measures, wraps and
 * shrinks to fit exactly as if it were finished, so nothing reflows, the
 * centring does not drift, and `adjustsFontSizeToFit` settles on one size
 * instead of re-deciding on every character.
 *
 * There is deliberately no blinking caret. A caret between the typed text and
 * the transparent remainder pushes that remainder along as it goes, which is
 * the one thing this approach exists to avoid.
 *
 * A screen reader gets the finished sentence, never a half-typed one, because
 * the animation is decoration and a partial sentence is not what was meant.
 * It is also skipped entirely when the system asks for reduced motion.
 */
export function TypeOn({
  text,
  speed = 38,
  delay = 0,
  style,
  numberOfLines,
  adjustsFontSizeToFit,
  onDone,
}: Props): React.JSX.Element {
  const [typed, setTyped] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let start: ReturnType<typeof setTimeout> | undefined;

    function finish() {
      setTyped(text.length);
      done.current?.();
    }

    setTyped(0);

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduced => {
        if (cancelled) {
          return;
        }
        if (reduced) {
          finish();
          return;
        }
        start = setTimeout(() => {
          timer = setInterval(() => {
            setTyped(current => {
              const next = current + 1;
              if (next >= text.length) {
                if (timer) {
                  clearInterval(timer);
                }
                done.current?.();
                return text.length;
              }
              return next;
            });
          }, speed);
        }, delay);
      })
      // An unreadable accessibility setting is not a reason to show nothing.
      .catch(finish);

    return () => {
      cancelled = true;
      if (start) {
        clearTimeout(start);
      }
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [text, speed, delay]);

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      accessibilityLabel={text}>
      {text.slice(0, typed)}
      <Text style={styles.pending}>{text.slice(typed)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  // Present, so it still takes up its space - just not visible yet.
  pending: {color: 'transparent'},
});
