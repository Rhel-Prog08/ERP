import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ViewStyle,
  View,
} from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme } from '../../context/ThemeContext';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SelectProps<T extends string = string> {
  label: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  containerStyle?: React.ComponentProps<typeof View>['style'];
  /** Altura máxima del menú (px). Por defecto 240. */
  menuMaxHeight?: number;
}

/** Posición fija (viewport) del menú desplegado en web. */
interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;
const MENU_Z_INDEX = 2000;
/** Altura mínima "cómoda" para abrir hacia abajo antes de intentar hacia arriba. */
const MIN_COMFORT_BELOW = 180;

/**
 * Obtiene el nodo DOM de un ref de componente host de react-native-web.
 * tolera: elemento DOM directo, {_nativeRef}, {getNode()}.
 */
function domNode(ref: React.RefObject<unknown>): HTMLElement | null {
  const el = ref.current as
    | (HTMLElement & { _nativeRef?: { current?: HTMLElement }; getNode?: () => HTMLElement })
    | null
    | undefined;
  if (!el) return null;
  if (typeof (el as HTMLElement).getBoundingClientRect === 'function') return el as HTMLElement;
  if (el._nativeRef?.current) return el._nativeRef.current;
  if (typeof el.getNode === 'function') return el.getNode();
  return null;
}

/**
 * Selector multiplataforma propio (web + nativo).
 *
 * En web el menú se renderiza en un PORTAL (document.body) con posición fija
 * calculada con getBoundingClientRect(): así escapa del recorte de ScrollView,
 * Modal y contenedores con overflow, se dibuja por encima del resto de
 * controles (jerarquía visual real, no sólo zIndex) y sus eventos (clic
 * fuera, Escape) se gestionan a nivel de documento.
 */
export function Select<T extends string = string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecciona una opción',
  error,
  disabled = false,
  containerStyle,
  menuMaxHeight = 240,
}: SelectProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<View>(null);
  const menuRef = useRef<View>(null);

  const selected = options.find((o) => o.value === value);
  const isWeb = Platform.OS === 'web';

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  /** Recalcula la posición del menú respecto al disparador y el viewport. */
  const measure = useCallback(() => {
    const node = domNode(triggerRef);
    if (!node || typeof window === 'undefined') return;
    const rect = node.getBoundingClientRect();
    const wanted = Math.min(menuMaxHeight, window.innerHeight - 2 * VIEWPORT_MARGIN);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;

    let maxHeight: number;
    let placement: 'below' | 'above';
    if (spaceBelow >= Math.min(wanted, MIN_COMFORT_BELOW)) {
      placement = 'below';
      maxHeight = Math.min(wanted, spaceBelow);
    } else if (spaceAbove > spaceBelow) {
      placement = 'above';
      maxHeight = Math.min(wanted, spaceAbove);
    } else {
      placement = 'below';
      maxHeight = Math.max(80, Math.min(wanted, spaceBelow));
    }

    const next: MenuPosition = {
      left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - rect.width - VIEWPORT_MARGIN)),
      width: rect.width,
      maxHeight: Math.max(80, maxHeight),
    };
    if (placement === 'below') next.top = rect.bottom + MENU_GAP;
    else next.bottom = window.innerHeight - rect.top + MENU_GAP;
    setPos(next);
  }, [menuMaxHeight]);

  const focusOption = useCallback((index: number) => {
    const menu = domNode(menuRef);
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'));
    if (items.length === 0) return;
    const target = items[((index % items.length) + items.length) % items.length];
    target.focus();
  }, []);

  /* ---------------------- Efectos del menú abierto (web) ---------------------- */
  useEffect(() => {
    if (!open || !isWeb || typeof window === 'undefined') return undefined;

    measure();
    const onViewportChange = () => measure();
    window.addEventListener('resize', onViewportChange);
    // Captura: también reacciona al scroll de cualquier ScrollView ancestro.
    window.addEventListener('scroll', onViewportChange, true);

    const onPointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      const trigger = domNode(triggerRef);
      const menu = domNode(menuRef);
      if (trigger?.contains(target) || menu?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        domNode(triggerRef)?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // Al abrir con teclado, el foco pasa al primer elemento del menú.
    const raf = window.requestAnimationFrame(() => focusOption(0));

    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(raf);
    };
  }, [open, isWeb, measure, close, focusOption]);

  const handleSelect = (option: SelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
    domNode(triggerRef)?.focus();
  };

  const trigger = (
    <Pressable
      ref={triggerRef}
      accessibilityRole="button"
      accessibilityState={{ expanded: open, disabled }}
      accessibilityLabel={`${label}. ${selected ? selected.label : placeholder}`}
      disabled={disabled}
      onPress={() => (open ? close() : setOpen(true))}
      style={(state) => {
        const focused = (state as { focused?: boolean }).focused ?? false;
        return [
          styles.field,
          {
            borderColor: error ? c.danger : open ? c.primary : c.border,
            backgroundColor: c.card,
            opacity: disabled ? 0.6 : 1,
            ...(focused && !disabled && !open ? { borderColor: c.primary } : null),
          } as ViewStyle,
          // Sin anillo por defecto (RNW lo añade); el foco se comunica con el borde.
          { outlineStyle: 'none' } as unknown as ViewStyle,
        ];
      }}
    >
      <Text style={[styles.value, { color: selected ? c.text : c.textLight }]} numberOfLines={1}>
        {selected ? selected.label : placeholder}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 12, marginLeft: 8 }}>{open ? '▲' : '▼'}</Text>
    </Pressable>
  );

  const renderOptions = () =>
    options.map((option) => {
      const isSelected = option.value === value;
      return (
        <Pressable
          key={option.value}
          accessibilityRole="menuitem"
          accessibilityState={{ disabled: Boolean(option.disabled), selected: isSelected }}
          disabled={option.disabled}
          onPress={() => handleSelect(option)}
          style={(state) => {
            const { pressed } = state;
            const focused = (state as { focused?: boolean }).focused ?? false;
            return [
              styles.option,
              {
                backgroundColor: isSelected
                  ? c.primaryLight
                  : pressed || focused
                    ? c.neutralBg
                    : 'transparent',
                opacity: option.disabled ? 0.5 : 1,
              } as ViewStyle,
              { outlineStyle: 'none' } as unknown as ViewStyle,
            ];
          }}
        >
          <Text style={[styles.optionLabel, { color: isSelected ? c.primary : c.text }]} numberOfLines={2}>
            {option.label}
          </Text>
          {isSelected ? <Text style={{ color: c.primary, fontWeight: '700' }}>✓</Text> : null}
        </Pressable>
      );
    });

  const menuChildren = <ScrollView style={{ maxHeight: menuMaxHeight }} keyboardShouldPersistTaps="handled">{renderOptions()}</ScrollView>;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      {trigger}

      {open && isWeb
        ? pos
          ? createPortal(
              <View
                ref={menuRef}
                accessibilityRole="menu"
                accessibilityLabel={label}
                style={
                  {
                    position: 'fixed',
                    top: pos.top,
                    bottom: pos.bottom,
                    left: pos.left,
                    width: pos.width,
                    maxHeight: pos.maxHeight,
                    zIndex: MENU_Z_INDEX,
                    backgroundColor: c.card,
                    borderColor: c.border,
                    borderWidth: 1,
                    borderRadius: 10,
                    overflow: 'hidden',
                    ...theme.shadow,
                  } as unknown as ViewStyle
                }
              >
                {menuChildren}
              </View>,
              document.body
            )
          : null
        : open
          ? (
            // Fallback nativo (sin portal): menú anidado bajo el campo.
            <View style={[styles.dropdownNative, { backgroundColor: c.card, borderColor: c.border }, theme.shadow]}>
              {menuChildren}
            </View>
          )
          : null}

      {error ? <Text style={{ fontSize: 12, color: c.danger, fontWeight: '500' }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  value: { fontSize: 14, flex: 1 },
  dropdownNative: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    zIndex: 50,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionLabel: { fontSize: 14, flex: 1 },
});
