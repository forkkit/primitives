import * as React from 'react';
import {
  createContext,
  useComposedRefs,
  composeEventHandlers,
  useControlledState,
  useId,
  composeRefs,
} from '@radix-ui/react-utils';
import { forwardRefWithAs } from '@radix-ui/react-polymorphic';
import { getPartDataAttrObj, makeId } from '@radix-ui/utils';
import { DismissableLayer } from '@radix-ui/react-dismissable-layer';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { Portal } from '@radix-ui/react-portal';
import { Presence } from '@radix-ui/react-presence';
import { useFocusGuards } from '@radix-ui/react-focus-guards';
import { RemoveScroll } from 'react-remove-scroll';
import { hideOthers } from 'aria-hidden';

type DismissableLayerProps = React.ComponentProps<typeof DismissableLayer>;
type FocusScopeProps = React.ComponentProps<typeof FocusScope>;

/* -------------------------------------------------------------------------------------------------
 * Root level context
 * -----------------------------------------------------------------------------------------------*/

type DialogContextValue = {
  triggerRef: React.RefObject<HTMLButtonElement>;
  id: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const [DialogContext, useDialogContext] = createContext<DialogContextValue>(
  'DialogContext',
  'Dialog'
);

/* -------------------------------------------------------------------------------------------------
 * Dialog
 * -----------------------------------------------------------------------------------------------*/

const DIALOG_NAME = 'Dialog';

type DialogOwnProps = {
  id?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const Dialog: React.FC<DialogOwnProps> = (props) => {
  const { children, id: idProp, open: openProp, defaultOpen, onOpenChange } = props;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const generatedId = makeId('dialog', useId());
  const id = idProp || generatedId;
  const [open = false, setOpen] = useControlledState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const context = React.useMemo(() => ({ triggerRef, id, open, setOpen }), [id, open, setOpen]);

  return <DialogContext.Provider value={context}>{children}</DialogContext.Provider>;
};

Dialog.displayName = DIALOG_NAME;

/* -------------------------------------------------------------------------------------------------
 * DialogTrigger
 * -----------------------------------------------------------------------------------------------*/

const TRIGGER_NAME = 'DialogTrigger';
const TRIGGER_DEFAULT_TAG = 'button';

const DialogTrigger = forwardRefWithAs<typeof TRIGGER_DEFAULT_TAG>((props, forwardedRef) => {
  const { as: Comp = TRIGGER_DEFAULT_TAG, onClick, ...triggerProps } = props;
  const context = useDialogContext(TRIGGER_NAME);
  const composedTriggerRef = useComposedRefs(forwardedRef, context.triggerRef);

  return (
    <Comp
      {...getPartDataAttrObj(TRIGGER_NAME)}
      ref={composedTriggerRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={context.open}
      aria-controls={context.id}
      onClick={composeEventHandlers(onClick, () => context.setOpen(true))}
      {...triggerProps}
    />
  );
});

DialogTrigger.displayName = TRIGGER_NAME;

/* -------------------------------------------------------------------------------------------------
 * DialogOverlay
 * -----------------------------------------------------------------------------------------------*/

const OVERLAY_NAME = 'DialogOverlay';
const OVERLAY_DEFAULT_TAG = 'div';

type DialogOverlayOwnProps = {
  /**
   * Used to force mounting when more control is needed. Useful when
   * controlling animation with React animation libraries.
   */
  forceMount?: true;
};

const DialogOverlay = forwardRefWithAs<typeof DialogOverlayImpl, DialogOverlayOwnProps>(
  (props, forwardedRef) => {
    const { forceMount, ...overlayProps } = props;
    const context = useDialogContext(OVERLAY_NAME);
    return (
      <Presence present={forceMount || context.open}>
        <DialogOverlayImpl
          {...overlayProps}
          data-state={getState(context.open)}
          ref={forwardedRef}
        />
      </Presence>
    );
  }
);

const DialogOverlayImpl = forwardRefWithAs<typeof OVERLAY_DEFAULT_TAG>((props, forwardedRef) => {
  const { as: Comp = OVERLAY_DEFAULT_TAG, ...overlayProps } = props;
  return (
    <Portal>
      <Comp {...getPartDataAttrObj(OVERLAY_NAME)} ref={forwardedRef} {...overlayProps} />
    </Portal>
  );
});

DialogOverlay.displayName = OVERLAY_NAME;

/* -------------------------------------------------------------------------------------------------
 * DialogContent
 * -----------------------------------------------------------------------------------------------*/

const CONTENT_NAME = 'DialogContent';
const CONTENT_DEFAULT_TAG = 'div';

type DialogContentOwnProps = {
  /**
   * Used to force mounting when more control is needed. Useful when
   * controlling animation with React animation libraries.
   */
  forceMount?: true;
};

const DialogContent = forwardRefWithAs<typeof DialogContentImpl, DialogContentOwnProps>(
  (props, forwardedRef) => {
    const { forceMount, ...contentProps } = props;
    const context = useDialogContext(CONTENT_NAME);
    return (
      <Presence present={forceMount || context.open}>
        <DialogContentImpl
          {...contentProps}
          data-state={getState(context.open)}
          ref={forwardedRef}
        />
      </Presence>
    );
  }
);

type DialogContentImplOwnProps = {
  /**
   * Event handler called when auto-focusing on open.
   * Can be prevented.
   */
  onOpenAutoFocus?: FocusScopeProps['onMountAutoFocus'];

  /**
   * Event handler called when auto-focusing on close.
   * Can be prevented.
   */
  onCloseAutoFocus?: FocusScopeProps['onUnmountAutoFocus'];

  /**
   * Event handler called when the escape key is down.
   * Can be prevented.
   */
  onEscapeKeyDown?: DismissableLayerProps['onEscapeKeyDown'];

  /**
   * Event handler called when the a pointer event happens outside of the `Dialog`.
   * Can be prevented.
   */
  onPointerDownOutside?: DismissableLayerProps['onPointerDownOutside'];
};

const DialogContentImpl = forwardRefWithAs<typeof CONTENT_DEFAULT_TAG, DialogContentImplOwnProps>(
  (props, forwardedRef) => {
    const {
      as: Comp = CONTENT_DEFAULT_TAG,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onEscapeKeyDown,
      onPointerDownOutside,
      ...contentProps
    } = props;
    const context = useDialogContext(CONTENT_NAME);

    // Make sure the whole tree has focus guards as our `Dialog` will be
    // the last element in the DOM (beacuse of the `Portal`)
    useFocusGuards();

    // Hide everything from ARIA except the content
    const contentRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
      const content = contentRef.current;
      if (content) return hideOthers(content);
    }, []);

    return (
      <Portal>
        <RemoveScroll>
          <FocusScope
            trapped
            onMountAutoFocus={onOpenAutoFocus}
            onUnmountAutoFocus={onCloseAutoFocus}
          >
            {(focusScopeProps) => (
              <DismissableLayer
                disableOutsidePointerEvents
                onEscapeKeyDown={onEscapeKeyDown}
                onPointerDownOutside={onPointerDownOutside}
                onDismiss={() => context.setOpen(false)}
              >
                {(dismissableLayerProps) => (
                  <Comp
                    {...getPartDataAttrObj(CONTENT_NAME)}
                    role="dialog"
                    aria-modal
                    {...contentProps}
                    ref={composeRefs(
                      forwardedRef,
                      contentRef,
                      focusScopeProps.ref,
                      dismissableLayerProps.ref
                    )}
                    id={context.id}
                    style={{
                      ...dismissableLayerProps.style,
                      ...contentProps.style,
                    }}
                    onBlurCapture={composeEventHandlers(
                      contentProps.onBlurCapture,
                      dismissableLayerProps.onBlurCapture,
                      { checkForDefaultPrevented: false }
                    )}
                    onFocusCapture={composeEventHandlers(
                      contentProps.onFocusCapture,
                      dismissableLayerProps.onFocusCapture,
                      { checkForDefaultPrevented: false }
                    )}
                    onMouseDownCapture={composeEventHandlers(
                      contentProps.onMouseDownCapture,
                      dismissableLayerProps.onMouseDownCapture,
                      { checkForDefaultPrevented: false }
                    )}
                    onTouchStartCapture={composeEventHandlers(
                      contentProps.onTouchStartCapture,
                      dismissableLayerProps.onTouchStartCapture,
                      { checkForDefaultPrevented: false }
                    )}
                  />
                )}
              </DismissableLayer>
            )}
          </FocusScope>
        </RemoveScroll>
      </Portal>
    );
  }
);

DialogContent.displayName = CONTENT_NAME;

/* -------------------------------------------------------------------------------------------------
 * DialogClose
 * -----------------------------------------------------------------------------------------------*/

const CLOSE_NAME = 'DialogClose';
const CLOSE_DEFAULT_TAG = 'button';

const DialogClose = forwardRefWithAs<typeof CLOSE_DEFAULT_TAG>((props, forwardedRef) => {
  const { as: Comp = CLOSE_DEFAULT_TAG, onClick, ...closeProps } = props;
  const context = useDialogContext(CLOSE_NAME);

  return (
    <Comp
      {...getPartDataAttrObj(CLOSE_NAME)}
      ref={forwardedRef}
      type="button"
      {...closeProps}
      onClick={composeEventHandlers(onClick, () => context.setOpen(false))}
    />
  );
});

DialogClose.displayName = CLOSE_NAME;

/* -----------------------------------------------------------------------------------------------*/

function getState(open: boolean) {
  return open ? 'open' : 'closed';
}

const Root = Dialog;
const Trigger = DialogTrigger;
const Overlay = DialogOverlay;
const Content = DialogContent;
const Close = DialogClose;

export {
  Dialog,
  DialogTrigger,
  DialogOverlay,
  DialogContent,
  DialogClose,
  //
  Root,
  Trigger,
  Overlay,
  Content,
  Close,
};
