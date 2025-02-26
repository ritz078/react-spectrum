import {createFocusManager, getFocusableTreeWalker} from '@react-aria/focus';
import {DateFieldState, DatePickerState, DateRangePickerState} from '@react-stately/datepicker';
import {FocusableElement, KeyboardEvent, RefObject} from '@react-types/shared';
import {mergeProps, useLayoutEffect} from '@react-aria/utils';
import {useLocale} from '@react-aria/i18n';
import {useMemo, useRef} from 'react';
import {usePress} from '@react-aria/interactions';

export function useDatePickerGroup(state: DatePickerState | DateRangePickerState | DateFieldState, ref: RefObject<Element | null>, disableArrowNavigation?: boolean) {
  let {direction} = useLocale();
  let focusManager = useMemo(() => createFocusManager(ref), [ref]);
  let segments = useRef<FocusableElement[]>(undefined);
  useLayoutEffect(() => {
    if (ref?.current) {

      let update = () => {
        if (ref.current) {
          // TODO: For now, just querying this list of elements. However, it's possible that either through hooks or RAC that some users may include other focusable items that they would want to able to keyboard navigate to. In that case, we might want to utilize focusableElements in isFocusable.ts
          let editableSegments: NodeListOf<Element> | undefined = ref.current?.querySelectorAll('span[role="spinbutton"], span[role="textbox"], button, div[role="spinbutton"], div[role="textbox"]');

          let segmentsArr = Array.from(editableSegments as NodeListOf<Element>).filter(Boolean).map(node => {
            return {
              element: node as FocusableElement,
              rectX: node.getBoundingClientRect().left
            };
          });
      
          let orderedSegments = segmentsArr.sort((a, b) => a.rectX - b.rectX).map((item => item.element));
          segments.current = orderedSegments;
        }
      };

      update();

      let observer = new MutationObserver(update);
      observer.observe(ref.current, {
        subtree: true,
        childList: true
      });

      return () => {
        observer.disconnect();
      };
    }
  }, []);

  // Open the popover on alt + arrow down
  let onKeyDown = (e: KeyboardEvent) => {
    if (!e.currentTarget.contains(e.target)) {
      return;
    }

    if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && 'setOpen' in state) {
      e.preventDefault();
      e.stopPropagation();
      state.setOpen(true);
    }

    if (disableArrowNavigation) {
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        if (direction === 'rtl') {
          if (segments.current) {
            let orderedSegments = segments.current;
            let target = e.target as FocusableElement;
            let index = orderedSegments.indexOf(target);

            if (index === 0) {
              target = orderedSegments[0] || target;
            } else {
              target = orderedSegments[index - 1] || target;
            }

            if (target) {
              target.focus();
            }
          }
        } else {
          focusManager.focusPrevious();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        if (direction === 'rtl') {
          if (segments.current) {
            let orderedSegments = segments.current;
            let target = e.target as FocusableElement;
            let index = orderedSegments.indexOf(target);

            if (index === orderedSegments.length - 1) {
              target = orderedSegments[orderedSegments.length - 1] || target;
            } else {
              target = orderedSegments[index - 1] || target;
            }

  
            target = orderedSegments[index + 1] || target;
  
            if (target) {
              target.focus();
            }
          }
        } else {
          focusManager.focusNext();
        }
        break;
    }
  };

  // Focus the first placeholder segment from the end on mouse down/touch up in the field.
  let focusLast = () => {
    if (!ref.current) {
      return;
    }
    // Try to find the segment prior to the element that was clicked on.
    let target = window.event?.target as FocusableElement;
    let walker = getFocusableTreeWalker(ref.current, {tabbable: true});
    if (target) {
      walker.currentNode = target;
      target = walker.previousNode() as FocusableElement;
    }

    // If no target found, find the last element from the end.
    if (!target) {
      let last: FocusableElement;
      do {
        last = walker.lastChild() as FocusableElement;
        if (last) {
          target = last;
        }
      } while (last);
    }

    // Now go backwards until we find an element that is not a placeholder.
    while (target?.hasAttribute('data-placeholder')) {
      let prev = walker.previousNode() as FocusableElement;
      if (prev && prev.hasAttribute('data-placeholder')) {
        target = prev;
      } else {
        break;
      }
    }

    if (target) {
      target.focus();
    }
  };

  let {pressProps} = usePress({
    preventFocusOnPress: true,
    allowTextSelectionOnPress: true,
    onPressStart(e) {
      if (e.pointerType === 'mouse') {
        focusLast();
      }
    },
    onPress(e) {
      if (e.pointerType !== 'mouse') {
        focusLast();
      }
    }
  });

  return mergeProps(pressProps, {onKeyDown});
}
