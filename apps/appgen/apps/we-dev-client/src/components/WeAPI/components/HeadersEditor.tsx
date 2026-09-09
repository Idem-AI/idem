import React from 'react';
import { Input, Button, Space } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { KeyValuePair } from '../types';

interface HeadersEditorProps {
  headers: KeyValuePair[];
  onUpdate: (headers: KeyValuePair[]) => void;
}

function HeadersEditor({ headers, onUpdate }: HeadersEditorProps): JSX.Element {
  const handleHeaderChange = (index: number, key: string, value: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], [key]: value };
    onUpdate(newHeaders);
  };

  return (
    <div className="text-sm">
      {headers.map((header, index) => (
        <Space key={index} style={{ display: 'flex', marginBottom: 8 }}>
          <Input
            placeholder="Key"
            value={header.key}
            onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
            style={{ width: 200 }}
          />
          <Input
            placeholder="Value"
            value={header.value}
            onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
            style={{ width: 200 }}
          />
          <Button
            type="text"
            icon={<Trash2 size={14} />}
            onClick={() => {
              const newHeaders = headers.filter((_, i) => i !== index);
              onUpdate(newHeaders);
            }}
          />
        </Space>
      ))}
      <Button
        type="dashed"
        onClick={() => onUpdate([...headers, { key: '', value: '' }])}
        icon={<Plus size={14} />}
      >
        Add Header
      </Button>
    </div>
  );
}

export default HeadersEditor; 