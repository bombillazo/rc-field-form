import warning from 'rc-util/lib/warning';
import * as React from 'react';
import Field from './Field';
import FieldContext from './FieldContext';
import type { ListContextProps } from './ListContext';
import ListContext from './ListContext';
import type { InternalNamePath, Meta, NamePath, StoreValue, ValidatorRule } from './interface';
import { getNamePath, move } from './utils/valueUtil';

export interface ListField {
  name: number;
  key: number;
  isListField: boolean;
}

export interface ListOperations {
  add: (defaultValue?: StoreValue, index?: number) => void;
  remove: (index: number | number[]) => void;
  move: (from: number, to: number) => void;
}

export interface ListProps<Values = any> {
  name: NamePath<Values>;
  rules?: ValidatorRule[];
  validateTrigger?: string | string[] | false;
  initialValue?: any[];
  children?: (
    fields: ListField[],
    operations: ListOperations,
    meta: Meta,
  ) => JSX.Element | React.ReactNode;

  /** @private Passed by Form.List props. Do not use since it will break by path check. */
  isListField?: boolean;
}

function List<Values = any>({
  name,
  initialValue,
  children,
  rules,
  validateTrigger,
  isListField,
}: ListProps<Values>) {
  const context = React.useContext(FieldContext);
  const wrapperListContext = React.useContext(ListContext);
  const keyRef = React.useRef({
    keys: [],
    id: 0,
  });
  const keyManager = keyRef.current;

  const prefixName: InternalNamePath = React.useMemo(() => {
    const parentPrefixName = getNamePath(context.prefixName) || [];
    return [...parentPrefixName, ...getNamePath(name)];
  }, [context.prefixName, name]);

  const fieldContext = React.useMemo(() => ({ ...context, prefixName }), [context, prefixName]);

  // List context
  const listContext = React.useMemo<ListContextProps>(
    () => ({
      getKey: (namePath: InternalNamePath) => {
        const len = prefixName.length;
        const pathName = namePath[len];
        return [keyManager.keys[pathName], namePath.slice(len + 1)];
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefixName],
  );

  // User should not pass `children` as other type.
  if (typeof children !== 'function') {
    warning(false, 'Form.List only accepts function as children.');
    return null;
  }

  const shouldUpdate = (prevValue: StoreValue, nextValue: StoreValue, { source }) => {
    if (source === 'internal') {
      return false;
    }
    return prevValue !== nextValue;
  };

  return (
    <ListContext.Provider value={listContext}>
      <FieldContext.Provider value={fieldContext}>
        <Field
          name={[]}
          shouldUpdate={shouldUpdate}
          rules={rules}
          validateTrigger={validateTrigger}
          initialValue={initialValue}
          isList
          isListField={isListField ?? !!wrapperListContext}
        >
          {({ value = [], onChange }, meta) => {
            const { getFieldValue } = context;
            const getNewValue = () => {
              const values = getFieldValue(prefixName || []) as StoreValue[];
              return values || [];
            };
            /**
             * Always get latest value in case user update fields by `form` api.
             */
            const operations: ListOperations = {
              add: (defaultValue, index?: number) => {
                // Mapping keys
                const newValue = getNewValue();

                if (index >= 0 && index <= newValue.length) {
                  keyManager.keys = [
                    ...keyManager.keys.slice(0, index),
                    keyManager.id,
                    ...keyManager.keys.slice(index),
                  ];
                  onChange([...newValue.slice(0, index), defaultValue, ...newValue.slice(index)]);
                } else {
                  if (
                    process.env.NODE_ENV !== 'production' &&
                    (index < 0 || index > newValue.length)
                  ) {
                    warning(
                      false,
                      'The second parameter of the add function should be a valid positive number.',
                    );
                  }
                  keyManager.keys = [...keyManager.keys, keyManager.id];
                  onChange([...newValue, defaultValue]);
                }
                keyManager.id += 1;
              },
              remove: (index: number | number[]) => {
                const newValue = getNewValue();
                const indexSet = new Set(Array.isArray(index) ? index : [index]);

                if (indexSet.size <= 0) {
                  return;
                }
                keyManager.keys = keyManager.keys.filter(
                  (_, keysIndex) => !indexSet.has(keysIndex),
                );

                // Trigger store change
                onChange(newValue.filter((_, valueIndex) => !indexSet.has(valueIndex)));
              },
              move(from: number, to: number) {
                if (from === to) {
                  return;
                }
                const newValue = getNewValue();

                // Do not handle out of range
                if (from < 0 || from >= newValue.length || to < 0 || to >= newValue.length) {
                  return;
                }

                keyManager.keys = move(keyManager.keys, from, to);

                // Trigger store change
                onChange(move(newValue, from, to));
              },
            };

            let listValue = value || [];
            if (!Array.isArray(listValue)) {
              listValue = [];

              if (process.env.NODE_ENV !== 'production') {
                warning(
                  false,
                  `Current value of '${prefixName.join(' > ')}' is not an array type.`,
                );
              }
            }

            return children(
              (listValue as StoreValue[]).map((__, index): ListField => {
                let key = keyManager.keys[index];
                if (key === undefined) {
                  keyManager.keys[index] = keyManager.id;
                  key = keyManager.keys[index];
                  keyManager.id += 1;
                }

                return {
                  name: index,
                  key,
                  isListField: true,
                };
              }),
              operations,
              meta,
            );
          }}
        </Field>
      </FieldContext.Provider>
    </ListContext.Provider>
  );
}

export default List;
