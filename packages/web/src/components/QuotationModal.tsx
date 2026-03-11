import { useState } from 'react';
import { X, FileText, MessageCircle, Download } from 'lucide-react';
import jsPDF from 'jspdf';

// ═══════════════════════════════════════════════════════════════════════
// QUOTATION LINE ITEM TYPE
// ═══════════════════════════════════════════════════════════════════════

export interface QuotationLineItem {
    label: string;
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
// QUOTATION MODAL
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

    const quotationNo = `QTN-${Date.now().toString(36).toUpperCase()}`;
    const quotationDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    const canGenerate = clientName.trim() && companyName.trim();

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

        // Items (amounts have profit already merged in)
        let subtotalBeforeGst = 0;
        let totalGst = 0;

        data.items.forEach((item, i) => {
            text += `${i + 1}. ${item.label}: ₹${item.amount.toFixed(2)}\n`;
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

            // ── Colors ──
            const primary = [16, 24, 40] as [number, number, number];       // dark gray
            const accent = [5, 150, 105] as [number, number, number];       // emerald
            const lightBg = [248, 250, 252] as [number, number, number];    // gray-50
            const borderColor = [226, 232, 240] as [number, number, number]; // gray-200

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
            doc.setTextColor(100, 116, 139); // gray-500
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

            // ── Table rows ──
            let subtotalBeforeGst = 0;
            let totalGst = 0;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);

            data.items.forEach((item, i) => {
                // Alternate row bg
                if (i % 2 === 0) {
                    doc.setFillColor(252, 252, 253);
                    doc.rect(margin, y - 4, contentWidth, 8, 'F');
                }

                doc.setTextColor(...primary);
                doc.text(`${i + 1}`, margin + 3, y);
                doc.text(item.label, margin + 12, y);
                doc.text(`${item.amount.toFixed(2)}`, margin + contentWidth - 3, y, { align: 'right' });

                subtotalBeforeGst += item.amount;
                totalGst += item.gstAmount;
                y += 8;
            });

            // ── Bottom border ──
            doc.setDrawColor(...borderColor);
            doc.line(margin, y - 4, margin + contentWidth, y - 4);

            y += 4;

            // ── Totals section ──
            const totalsX = margin + contentWidth * 0.55;
            const totalsWidth = contentWidth * 0.45;

            // Subtotal
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text('Subtotal', totalsX, y);
            doc.setTextColor(...primary);
            doc.text(`₹${subtotalBeforeGst.toFixed(2)}`, margin + contentWidth - 3, y, { align: 'right' });
            y += 7;

            // GST breakdown per item (if any have GST)
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

            // Save
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
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 bg-gradient-to-r from-emerald-50 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-black">Generate Quotation</h2>
                            <p className="text-xs text-black/40">{quotationNo} · {quotationDate}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors" title="Close">
                        <X className="w-4 h-4 text-black/30" />
                    </button>
                </div>

                {/* Client Details Form */}
                <div className="px-6 py-5 space-y-4">
                    <h3 className="text-xs font-bold text-black/40 uppercase tracking-wider">Client Details</h3>

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

                    {/* Quotation Preview */}
                    <div className="border border-black/5 rounded-xl bg-black/[0.01] p-3 space-y-1.5 max-h-48 overflow-y-auto">
                        <h4 className="text-[10px] font-bold text-black/30 uppercase tracking-wider mb-2">Items Preview</h4>
                        {data.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-black/60">{item.label}</span>
                                <span className="font-mono text-black/80">₹{item.amount.toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="border-t border-black/5 pt-1.5 mt-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-black/70">Grand Total</span>
                                <span className="font-mono text-emerald-600">₹{data.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 border-t border-black/5 bg-black/[0.01] flex items-center gap-3">
                    <button
                        onClick={generatePDF}
                        disabled={!canGenerate || generating}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black text-white font-semibold text-sm hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Download className="w-4 h-4" />
                        {generating ? 'Generating...' : 'Download PDF'}
                    </button>
                    <button
                        onClick={shareWhatsApp}
                        disabled={!canGenerate}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
}
