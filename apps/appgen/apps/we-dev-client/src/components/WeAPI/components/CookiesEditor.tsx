import React from 'react';
import { Input, Button, Space } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { KeyValuePair } from '../types';

interface CookiesEditorProps {
    cookies: KeyValuePair[];
    onUpdate: (cookies: KeyValuePair[]) => void;
}

function CookiesEditor({ cookies, onUpdate }: CookiesEditorProps): JSX.Element {
    const handleCookieChange = (index: number, key: string, value: string) => {
        const newCookies = [...cookies];
        newCookies[index] = { ...newCookies[index], [key]: value };
        onUpdate(newCookies);
    };

    return (
        <div className="text-sm">
            {cookies.map((cookie, index) => (
                <Space key={index} style={{ display: 'flex', marginBottom: 8 }}>
                    <Input
                        placeholder="Key"
                        value={cookie.key}
                        onChange={(e) => handleCookieChange(index, 'key', e.target.value)}
                        style={{ width: 200 }}
                    />
                    <Input
                        placeholder="Value"
                        value={cookie.value}
                        onChange={(e) => handleCookieChange(index, 'value', e.target.value)}
                        style={{ width: 200 }}
                    />
                    <Button
                        type="text"
                        icon={<Trash2 size={14} />}
                        onClick={() => {
                            const newCookies = cookies.filter((_, i) => i !== index);
                            onUpdate(newCookies);
                        }}
                    />
                </Space>
            ))}
            <Button
                type="dashed"
                onClick={() => onUpdate([...cookies, { key: '', value: '' }])}
                icon={<Plus size={14} />}
            >
                Add Cookie
            </Button>
        </div>
    );
}

export default CookiesEditor;
