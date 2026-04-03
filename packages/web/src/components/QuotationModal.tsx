import { useState } from 'react';
import { X, FileText, MessageCircle, Download, ChevronLeft, Eye, Edit3 } from 'lucide-react';
import jsPDF from 'jspdf';

// ═══════════════════════════════════════════════════════════════════════
// QUOTATION LINE ITEM TYPE
// ═══════════════════════════════════════════════════════════════════════

export interface QuotationLineItem {
    label: string;
    description?: string;     // auto-generated from user inputs
    amount: number;           // afterProfit amount (profit baked in)
    gstPercent: number;
    gstAmount: number;
    finalAmount: number;      // afterProfit + gst
}

export interface QuotationData {
    items: QuotationLineItem[];
    grandTotal: number;
}

// ═══════════════════════════════════════════════════════════════════════
// QUOTATION MODAL — 2-step: Edit → Preview & Generate
// ═══════════════════════════════════════════════════════════════════════

export function QuotationModal({
    data,
    onClose,
}: {
    data: QuotationData;
    onClose: () => void;
}) {
    const [clientName, setClientName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [generating, setGenerating] = useState(false);
    const [step, setStep] = useState<'edit' | 'preview'>('edit');

    // Editable item descriptions (initialized from data)
    const [itemDescriptions, setItemDescriptions] = useState<Record<number, string>>(() => {
        const descs: Record<number, string> = {};
        data.items.forEach((item, i) => {
            if (item.description) descs[i] = item.description;
        });
        return descs;
    });

    const updateItemDescription = (index: number, value: string) => {
        setItemDescriptions((prev) => ({ ...prev, [index]: value }));
    };

    const quotationNo = `QTN-${Date.now().toString(36).toUpperCase()}`;
    const quotationDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    const canProceed = clientName.trim() && companyName.trim();

    // ── Build quotation text (for WhatsApp) ──────────────────────────
    const buildTextQuotation = () => {
        let text = `*QUOTATION*\n`;
        text += `No: ${quotationNo}\n`;
        text += `Date: ${quotationDate}\n\n`;
        text += `*Client:* ${clientName}\n`;
        text += `*Company:* ${companyName}\n`;
        if (clientEmail) text += `*Email:* ${clientEmail}\n`;
        if (clientPhone) text += `*Phone:* ${clientPhone}\n`;
        text += `\n---\n\n`;

        let subtotalBeforeGst = 0;
        let totalGst = 0;

        data.items.forEach((item, i) => {
            text += `${i + 1}. *${item.label}*: ₹${item.amount.toFixed(2)}\n`;
            const desc = itemDescriptions[i];
            if (desc?.trim()) {
                text += `   _${desc.trim()}_\n`;
            }
            subtotalBeforeGst += item.amount;
            totalGst += item.gstAmount;
        });

        text += `\n---\n`;
        text += `Subtotal: ₹${subtotalBeforeGst.toFixed(2)}\n`;
        if (totalGst > 0) {
            text += `GST: ₹${totalGst.toFixed(2)}\n`;
        }
        text += `*Grand Total: ₹${data.grandTotal.toFixed(2)}*\n`;

        return text;
    };

    // ── Share via WhatsApp ───────────────────────────────────────────
    const shareWhatsApp = () => {
        const text = buildTextQuotation();
        const phoneNumber = clientPhone.replace(/\D/g, '');
        const url = phoneNumber
            ? `https://wa.me/${phoneNumber.startsWith('91') ? phoneNumber : '91' + phoneNumber}?text=${encodeURIComponent(text)}`
            : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    // ── Generate PDF ─────────────────────────────────────────────────
    const generatePDF = () => {
        setGenerating(true);

        try {
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 20;
            const contentWidth = pageWidth - margin * 2;
            let y = margin;

            const primary = [16, 24, 40] as [number, number, number];
            const accent = [5, 150, 105] as [number, number, number];
            const lightBg = [248, 250, 252] as [number, number, number];
            const borderColor = [226, 232, 240] as [number, number, number];

            // ── Header bar ──
            doc.setFillColor(...accent);
            doc.rect(0, 0, pageWidth, 35, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('QUOTATION', margin, 18);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`No: ${quotationNo}`, margin, 27);
            doc.text(`Date: ${quotationDate}`, pageWidth - margin, 27, { align: 'right' });

            y = 50;

            // ── Client Details ──
            doc.setTextColor(...primary);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('BILL TO:', margin, y);
            y += 7;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(clientName, margin, y);
            y += 5;
            doc.setTextColor(100, 116, 139);
            doc.text(companyName, margin, y);
            y += 5;
            if (clientEmail) {
                doc.text(clientEmail, margin, y);
                y += 5;
            }
            if (clientPhone) {
                doc.text(`Phone: ${clientPhone}`, margin, y);
                y += 5;
            }

            y += 8;

            // ── Table header ──
            doc.setFillColor(...lightBg);
            doc.rect(margin, y, contentWidth, 10, 'F');
            doc.setDrawColor(...borderColor);
            doc.line(margin, y, margin + contentWidth, y);
            doc.line(margin, y + 10, margin + contentWidth, y + 10);

            doc.setTextColor(...primary);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('#', margin + 3, y + 7);
            doc.text('Description', margin + 12, y + 7);
            doc.text('Amount (₹)', margin + contentWidth - 3, y + 7, { align: 'right' });

            y += 14;

            // ── Table rows with descriptions ──
            let subtotalBeforeGst = 0;
            let totalGst = 0;

            data.items.forEach((item, i) => {
                if (y > doc.internal.pageSize.getHeight() - 40) {
                    doc.addPage();
                    y = margin;
                }

                // Item row
                if (i % 2 === 0) {
                    doc.setFillColor(252, 252, 253);
                    doc.rect(margin, y - 4, contentWidth, 8, 'F');
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(...primary);
                doc.text(`${i + 1}`, margin + 3, y);
                doc.text(item.label, margin + 12, y);
                doc.text(`${item.amount.toFixed(2)}`, margin + contentWidth - 3, y, { align: 'right' });
                y += 6;

                // Description under the item
                const desc = itemDescriptions[i];
                if (desc?.trim()) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139); // gray-500
                    const descLines = doc.splitTextToSize(desc.trim(), contentWidth - 15);
                    for (const line of descLines) {
                        if (y > doc.internal.pageSize.getHeight() - 30) {
                            doc.addPage();
                            y = margin;
                        }
                        doc.text(line, margin + 12, y);
                        y += 3.5;
                    }
                }

                y += 3;

                subtotalBeforeGst += item.amount;
                totalGst += item.gstAmount;
            });

            // ── Bottom border ──
            doc.setDrawColor(...borderColor);
            doc.line(margin, y - 2, margin + contentWidth, y - 2);

            y += 4;

            // ── Totals section ──
            const totalsX = margin + contentWidth * 0.55;
            const totalsWidth = contentWidth * 0.45;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text('Subtotal', totalsX, y);
            doc.setTextColor(...primary);
            doc.text(`₹${subtotalBeforeGst.toFixed(2)}`, margin + contentWidth - 3, y, { align: 'right' });
            y += 7;

            const itemsWithGst = data.items.filter((item) => item.gstPercent > 0);
            if (itemsWithGst.length > 0) {
                itemsWithGst.forEach((item) => {
                    doc.setTextColor(100, 116, 139);
                    doc.text(`GST ${item.gstPercent}% on ${item.label}`, totalsX, y);
                    doc.setTextColor(...primary);
                    doc.text(`₹${item.gstAmount.toFixed(2)}`, margin + contentWidth - 3, y, { align: 'right' });
                    y += 6;
                });
                y += 2;
            }

            // Grand Total
            doc.setFillColor(...accent);
            doc.roundedRect(totalsX - 3, y - 4, totalsWidth + 3, 12, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Grand Total', totalsX, y + 3);
            doc.text(`₹${data.grandTotal.toFixed(2)}`, margin + contentWidth - 3, y + 3, { align: 'right' });

            y += 20;

            // ── Footer ──
            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text('This is a computer-generated quotation.', pageWidth / 2, doc.internal.pageSize.getHeight() - 15, { align: 'center' });

            doc.save(`${quotationNo}.pdf`);
        } catch (err) {
            console.error('PDF generation error:', err);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slide-up max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 bg-gradient-to-r from-emerald-50 to-transparent shrink-0">
                    <div className="flex items-center gap-3">
                        {step === 'preview' && (
                            <button
                                onClick={() => setStep('edit')}
                                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                                title="Back to edit"
                            >
                                <ChevronLeft className="w-4 h-4 text-black/40" />
                            </button>
                        )}
                        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                            {step === 'edit' ? <Edit3 className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-black">
                                {step === 'edit' ? 'Quotation Details' : 'Review & Generate'}
                            </h2>
                            <p className="text-xs text-black/40">{quotationNo} · {quotationDate}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors" title="Close">
                        <X className="w-4 h-4 text-black/30" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto flex-1">
                    {step === 'edit' && (
                        <div className="px-6 py-5 space-y-5">
                            {/* Client Details */}
                            <div>
                                <h3 className="text-xs font-bold text-black/40 uppercase tracking-wider mb-3">Client Details</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-xs font-medium text-black/50 mb-1 block">Name *</label>
                                        <input
                                            type="text"
                                            value={clientName}
                                            onChange={(e) => setClientName(e.target.value)}
                                            placeholder="Client name"
                                            className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all"
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-xs font-medium text-black/50 mb-1 block">Company *</label>
                                        <input
                                            type="text"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                            placeholder="Company name"
                                            className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-black/50 mb-1 block">Email</label>
                                        <input
                                            type="email"
                                            value={clientEmail}
                                            onChange={(e) => setClientEmail(e.target.value)}
                                            placeholder="email@example.com"
                                            className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-black/50 mb-1 block">Phone</label>
                                        <input
                                            type="tel"
                                            value={clientPhone}
                                            onChange={(e) => setClientPhone(e.target.value)}
                                            placeholder="+91 98765 43210"
                                            className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Items list with editable descriptions */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-black/40 uppercase tracking-wider">Items & Details</h3>
                                    <span className="text-[10px] text-black/30">Edit descriptions below</span>
                                </div>
                                <div className="border border-black/5 rounded-xl overflow-hidden">
                                    {data.items.map((item, i) => (
                                        <div key={i} className={`px-3 py-3 ${i > 0 ? 'border-t border-black/5' : ''}`}>
                                            {/* Item header: label + amount */}
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-semibold text-black">{item.label}</span>
                                                <span className="font-mono text-sm font-semibold text-black/70">₹{item.amount.toFixed(2)}</span>
                                            </div>
                                            {/* Editable description under the item */}
                                            <textarea
                                                value={itemDescriptions[i] || ''}
                                                onChange={(e) => updateItemDescription(i, e.target.value)}
                                                rows={2}
                                                placeholder="Add details..."
                                                className="w-full text-[11px] text-black/50 bg-black/[0.02] border border-black/5 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-emerald-200 focus:border-emerald-200 resize-none leading-relaxed placeholder:text-black/20"
                                            />
                                        </div>
                                    ))}
                                    {/* Grand total */}
                                    <div className="px-3 py-2.5 border-t border-black/8 bg-emerald-50/50">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-emerald-700">Grand Total</span>
                                            <span className="font-mono text-sm font-bold text-emerald-600">₹{data.grandTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="px-6 py-5 space-y-4">
                            {/* Client info preview */}
                            <div className="rounded-xl bg-black/[0.02] border border-black/5 p-3">
                                <h4 className="text-[10px] font-bold text-black/30 uppercase tracking-wider mb-2">Bill To</h4>
                                <p className="text-sm font-semibold text-black">{clientName}</p>
                                <p className="text-xs text-black/50">{companyName}</p>
                                {clientEmail && <p className="text-xs text-black/40">{clientEmail}</p>}
                                {clientPhone && <p className="text-xs text-black/40">{clientPhone}</p>}
                            </div>

                            {/* Items preview with descriptions */}
                            <div className="rounded-xl border border-black/5 overflow-hidden">
                                {data.items.map((item, i) => (
                                    <div key={i} className={`px-3 py-2.5 ${i > 0 ? 'border-t border-black/5' : ''}`}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-black/70">{item.label}</span>
                                            <span className="font-mono text-xs font-semibold text-black/80">₹{item.amount.toFixed(2)}</span>
                                        </div>
                                        {itemDescriptions[i]?.trim() && (
                                            <p className="text-[10px] text-black/40 mt-0.5 leading-relaxed">{itemDescriptions[i].trim()}</p>
                                        )}
                                    </div>
                                ))}
                                {data.items.some((item) => item.gstAmount > 0) && (
                                    <div className="px-3 py-2 border-t border-black/5 space-y-1 bg-black/[0.01]">
                                        {data.items.filter((item) => item.gstAmount > 0).map((item, i) => (
                                            <div key={i} className="flex items-center justify-between text-[10px]">
                                                <span className="text-black/35">GST {item.gstPercent}% on {item.label}</span>
                                                <span className="font-mono text-black/40">₹{item.gstAmount.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="px-3 py-2.5 border-t border-emerald-200 bg-emerald-50/50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-emerald-700">Grand Total</span>
                                        <span className="font-mono text-xs font-bold text-emerald-600">₹{data.grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep('edit')}
                                className="w-full text-center text-xs text-black/30 hover:text-black/50 transition-colors py-1"
                            >
                                ← Back to edit details
                            </button>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 border-t border-black/5 bg-black/[0.01] flex items-center gap-3 shrink-0">
                    {step === 'edit' && (
                        <button
                            onClick={() => setStep('preview')}
                            disabled={!canProceed}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            <Eye className="w-4 h-4" />
                            Preview & Generate
                        </button>
                    )}

                    {step === 'preview' && (
                        <>
                            <button
                                onClick={generatePDF}
                                disabled={generating}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black text-white font-semibold text-sm hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <Download className="w-4 h-4" />
                                {generating ? 'Generating...' : 'Download PDF'}
                            </button>
                            <button
                                onClick={shareWhatsApp}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-500 transition-all"
                            >
                                <MessageCircle className="w-4 h-4" />
                                WhatsApp
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
