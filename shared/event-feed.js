// A lossless wire format for full static feeds. Repeated field values are sent
// once, while each occurrence retains its position and complete set of fields.
export const EVENT_FEED_FORMAT = 'ajsee-event-columns-v1';

export function copyJsonValue(value) {
  if (Array.isArray(value)) return value.map(copyJsonValue);
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      const copied = copyJsonValue(value[key]);
      if (key === '__proto__') {
        Object.defineProperty(result, key, { value: copied, enumerable: true, writable: true, configurable: true });
      } else result[key] = copied;
    }
    return result;
  }
  return value;
}

export function packEventFeed(payload) {
  if (!Array.isArray(payload?.events)) throw new Error('Invalid provider feed');
  const { events, ...metadata } = payload;
  const columns = [...new Set(events.flatMap(event => Object.keys(event)))];
  const values = [];
  const indices = new Map();
  const rows = events.map(event => columns.map(key => {
    if (!Object.hasOwn(event, key)) return -1;
    const value = event[key];
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error('Provider fields must be JSON values');
    if (!indices.has(serialized)) {
      indices.set(serialized, values.length);
      values.push(value);
    }
    return indices.get(serialized);
  }));
  return { format: EVENT_FEED_FORMAT, eventCount: events.length, metadata, columns, values, rows };
}

export function unpackEventFeed(payload) {
  // Older deployments and city subsets retain their original JSON format.
  if (Array.isArray(payload?.events)) return payload;
  if (payload?.format !== EVENT_FEED_FORMAT || !Array.isArray(payload.columns) ||
      !Array.isArray(payload.values) || !Array.isArray(payload.rows) ||
      !Number.isSafeInteger(payload.eventCount) || payload.eventCount !== payload.rows.length ||
      !payload.metadata || typeof payload.metadata !== 'object' || Array.isArray(payload.metadata)) {
    throw new Error('Invalid provider feed');
  }
  const { columns, values, rows } = payload;
  if (columns.some(key => typeof key !== 'string') || new Set(columns).size !== columns.length) {
    throw new Error('Invalid provider columns');
  }
  const events = rows.map(row => {
    if (!Array.isArray(row) || row.length !== columns.length) throw new Error('Invalid provider row');
    const event = {};
    for (let column = 0; column < columns.length; column++) {
      const index = row[column];
      if (!Number.isSafeInteger(index) || index < -1 || index >= values.length) {
        throw new Error('Invalid provider value reference');
      }
      if (index === -1) continue;
      const key = columns[column];
      // Copies prevent a caller changing another event through a shared value.
      const value = copyJsonValue(values[index]);
      if (key === '__proto__') {
        Object.defineProperty(event, key, { value, enumerable: true, writable: true, configurable: true });
      } else event[key] = value;
    }
    return event;
  });
  return { ...payload.metadata, events };
}
