import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function WorkspaceSidebar({ children }) {
    const [collapsed, setCollapsed] = useState(false);

    if (collapsed) {
        return (
            <aside className="flood-floating-stack flood-floating-stack-collapsed" aria-label="Collapsed flood workspace status">
                <button type="button" className="flood-rail-toggle" onClick={() => setCollapsed(false)} aria-label="Show flood workspace panel" title="Show workspace panel"><ChevronRight size={16} /></button>
            </aside>
        );
    }

    return (
        <aside className="flood-floating-stack" aria-label="Flood workspace status">
            <button type="button" className="flood-rail-toggle flood-rail-toggle-top" onClick={() => setCollapsed(true)} aria-label="Hide flood workspace panel" title="Hide workspace panel"><ChevronLeft size={16} /><span>Hide panel</span></button>
            <section className="flood-status-bento">
                <div className="flood-bento-heading"><span>System status</span><span className="flood-status-live"><i /> Online</span></div>
                <div className="flood-status-grid">
                    <div><span>Sensor</span><strong>NISAR L + S</strong></div>
                    <div><span>Epochs</span><strong>4 scenes</strong></div>
                    <div><span>Swath edge</span><strong>40 px</strong></div>
                    <div><span>Grid</span><strong>80 m</strong></div>
                </div>
                <div className="flood-parity"><span>Operational parity</span><strong>100.0%</strong></div>
            </section>
            <section className="flood-run-bento">
                <div className="flood-bento-heading"><span>Saved runs</span><span className="flood-run-count">Local gateway</span></div>
                {children}
            </section>
        </aside>
    );
}
