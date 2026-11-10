// Vercel Serverless Function: Brevo Transactional Email Handler
// Route: POST /api/send-email

export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.error('Missing BREVO_API_KEY environment variable.');
        return res.status(500).json({ success: false, error: 'Email service is not configured on the server.' });
    }

    try {
        const { type = 'order_confirmation', to, name, order, adminEmail } = req.body || {};

        if (!to && !adminEmail) {
            return res.status(400).json({ success: false, error: 'Recipient email address (to) is required.' });
        }

        const senderName = process.env.BREVO_SENDER_NAME || 'FreshCart';
        const senderEmail = process.env.BREVO_SENDER_EMAIL || 'ajeetdhakal9867165189@gmail.com';

        // Prepare email subject and content based on type
        let subject = 'Notification from FreshCart';
        let htmlContent = '';

        if (type === 'order_confirmation') {
            const customerName = name || 'Valued Customer';
            const orderId = order?.order_id || order?.id || 'FC-' + Math.floor(100000 + Math.random() * 900000);
            const total = order?.total ? parseFloat(order.total).toFixed(2) : '0.00';
            const subtotal = order?.subtotal ? parseFloat(order.subtotal).toFixed(2) : total;
            const deliveryFee = order?.delivery_fee ? parseFloat(order.delivery_fee).toFixed(2) : '50.00';
            const discount = order?.discount_amount ? parseFloat(order.discount_amount).toFixed(2) : null;
            const couponCode = order?.coupon_code || null;
            const items = Array.isArray(order?.items) ? order.items : [];
            const paymentMethod = order?.payment_method || 'Cash on Delivery (COD)';
            const shippingAddress = order?.shipping_address || 'Provided at checkout';

            subject = `Order Confirmation #${orderId} - FreshCart`;

            const itemRows = items.map(item => {
                const itemTotal = (parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2);
                const unit = item.unit || 'kg';
                return `
                    <tr style="border-bottom: 1px solid #edf2f7;">
                        <td style="padding: 12px 8px; font-weight: 600; color: #2d3748;">${item.name || 'Product'}</td>
                        <td style="padding: 12px 8px; text-align: center; color: #718096;">${item.quantity || 1} ${unit}</td>
                        <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: #2d3748;">Rs. ${itemTotal}</td>
                    </tr>
                `;
            }).join('');

            htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px; color: #2d3748; }
                    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
                    .header { background: linear-gradient(135deg, #60BB46, #489e32); padding: 28px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
                    .header p { margin: 6px 0 0; opacity: 0.9; font-size: 14px; }
                    .content { padding: 24px; }
                    .badge { display: inline-block; background-color: #ebfbee; color: #2b8a3e; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
                    table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px; }
                    .total-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #edf2f7; }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; color: #4a5568; }
                    .total-final { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #60BB46; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px; }
                    .address-box { background: #fdfdfd; border-left: 4px solid #60BB46; padding: 12px 16px; margin-top: 16px; font-size: 13px; color: #4a5568; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #a0aec0; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h1>FreshCart</h1>
                        <p>Farm Fresh Groceries Delivered to Your Door</p>
                    </div>
                    <div class="content">
                        <div class="badge">Order Received</div>
                        <p>Hi <strong>${customerName}</strong>,</p>
                        <p>Thank you for shopping with FreshCart! Your order has been placed and is currently being prepared.</p>
                        
                        <p style="margin: 12px 0 4px; font-size: 13px; color: #718096;"><strong>Order ID:</strong> ${orderId}</p>
                        <p style="margin: 4px 0 16px; font-size: 13px; color: #718096;"><strong>Payment Method:</strong> ${paymentMethod}</p>

                        <table>
                            <thead>
                                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #718096;">
                                    <th style="padding: 10px 8px; text-align: left;">Item</th>
                                    <th style="padding: 10px 8px; text-align: center;">Qty</th>
                                    <th style="padding: 10px 8px; text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemRows}
                            </tbody>
                        </table>

                        <div class="total-box">
                            <div class="total-row"><span>Subtotal:</span><span>Rs. ${subtotal}</span></div>
                            ${discount ? `<div class="total-row" style="color: #2b8a3e; font-weight: 600;"><span>Coupon Discount ${couponCode ? `(${couponCode})` : ''}:</span><span>-Rs. ${discount}</span></div>` : ''}
                            <div class="total-row"><span>Delivery Fee:</span><span>Rs. ${deliveryFee}</span></div>
                            <div class="total-final"><span>Total Amount:</span><span>Rs. ${total}</span></div>
                        </div>

                        <div class="address-box">
                            <strong>Delivery Address:</strong><br>
                            ${shippingAddress}
                        </div>
                    </div>
                    <div class="footer">
                        © ${new Date().getFullYear()} FreshCart Store. All rights reserved.<br>
                        Have questions? Contact us at support@freshcart.store
                    </div>
                </div>
            </body>
            </html>
            `;
        } else if (type === 'abandoned_cart') {
            const customerName = name || 'Valued Customer';
            const cartItems = Array.isArray(req.body.cart) ? req.body.cart : [];
            const coupon = req.body.couponCode || 'WELCOME10';

            subject = `🛒 Did you forget something fresh in your cart, ${customerName}?`;

            let subtotal = 0;
            const itemRows = cartItems.map(item => {
                const itemTotal = (parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2);
                subtotal += parseFloat(itemTotal);
                const unit = item.unit || 'kg';
                const imgSrc = item.image && item.image.startsWith('http') 
                    ? item.image 
                    : `https://freshcart-rust.vercel.app/${item.image ? item.image.replace(/^\//, '') : 'images/products/featured_1.jpg'}`;

                return `
                    <tr style="border-bottom: 1px solid #edf2f7;">
                        <td width="60" style="padding: 14px 16px;">
                            <img src="${imgSrc}" alt="${item.name || 'Product'}" width="50" height="50" style="border-radius: 8px; object-fit: cover; display: block;">
                        </td>
                        <td style="padding: 14px 10px;">
                            <div style="font-weight: 700; color: #2d3748; font-size: 14px;">${item.name || 'Product'}</div>
                            <div style="color: #718096; font-size: 12px; margin-top: 2px;">Qty: ${item.quantity || 1} ${unit}</div>
                        </td>
                        <td align="right" style="padding: 14px 16px; font-weight: 800; color: #2d3748; font-size: 15px;">
                            Rs. ${itemTotal}
                        </td>
                    </tr>
                `;
            }).join('');

            htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Your FreshCart Basket is Waiting</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f7f6; padding: 30px 10px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                                <tr>
                                    <td align="center" style="background: linear-gradient(135deg, #60BB46, #489e32); padding: 35px 20px; color: #ffffff;">
                                        <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">FreshCart</h1>
                                        <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95; font-weight: 500;">Farm Fresh Groceries at Your Doorstep</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 35px 30px 25px 30px;">
                                        <div style="text-align: center; margin-bottom: 24px;">
                                            <span style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                                                🛒 Cart Reminder
                                            </span>
                                            <h2 style="margin: 14px 0 8px 0; color: #1a202c; font-size: 22px; font-weight: 800;">
                                                Did you forget something fresh?
                                            </h2>
                                            <p style="margin: 0; color: #4a5568; font-size: 15px; line-height: 1.6;">
                                                Hi <strong>${customerName}</strong>, we noticed you left some delicious items in your basket. We've temporarily reserved them for you, but seasonal farm produce goes quickly!
                                            </p>
                                        </div>

                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #edf2f7; margin-bottom: 24px; overflow: hidden;">
                                            <tr>
                                                <td colspan="3" style="padding: 12px 16px; background-color: #edf2f7; font-size: 12px; font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.5px;">
                                                    Items In Your Cart
                                                </td>
                                            </tr>
                                            ${itemRows || '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #718096;">Your fresh items are waiting in your cart.</td></tr>'}
                                            <tr>
                                                <td colspan="2" align="right" style="padding: 14px 10px; font-size: 14px; color: #718096;">
                                                    Subtotal:
                                                </td>
                                                <td align="right" style="padding: 14px 16px; font-size: 16px; font-weight: 800; color: #60BB46;">
                                                    Rs. ${subtotal.toFixed(2)}
                                                </td>
                                            </tr>
                                        </table>

                                        ${coupon ? `
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0fdf4; border: 2px dashed #60BB46; border-radius: 12px; margin-bottom: 28px;">
                                            <tr>
                                                <td style="padding: 16px; text-align: center;">
                                                    <div style="font-size: 12px; font-weight: 800; color: #2b8a3e; text-transform: uppercase; letter-spacing: 0.5px;">
                                                        🏷️ First Order Bonus
                                                    </div>
                                                    <div style="font-size: 14px; color: #2d3748; margin-top: 4px;">
                                                        Don't forget to use coupon <strong style="color: #276749; letter-spacing: 1px;">${coupon}</strong> at checkout for <strong>10% OFF</strong>!
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                        ` : ''}

                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px;">
                                            <tr>
                                                <td align="center">
                                                    <a href="https://freshcart-rust.vercel.app/cart.html" target="_blank" style="display: inline-block; background-color: #60BB46; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 800; padding: 16px 36px; border-radius: 50px; box-shadow: 0 4px 14px rgba(96, 187, 70, 0.4); text-align: center;">
                                                        Return to Cart &amp; Checkout ➜
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>

                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                            <tr>
                                                <td align="center" style="font-size: 13px; color: #718096; line-height: 1.8;">
                                                    🚚 <strong>Express Local Delivery</strong> &nbsp;•&nbsp; 
                                                    🌿 <strong>100% Quality Guaranteed</strong> &nbsp;•&nbsp; 
                                                    💵 <strong>Cash on Delivery</strong>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="background-color: #f8fafc; padding: 25px 20px; border-top: 1px solid #edf2f7; font-size: 12px; color: #a0aec0; line-height: 1.6;">
                                        © ${new Date().getFullYear()} FreshCart Store. All rights reserved.<br>
                                        Kathmandu, Nepal • Need help? <a href="mailto:${senderEmail}" style="color: #60BB46; text-decoration: underline;">Contact Support</a><br>
                                        <span style="font-size: 11px; margin-top: 6px; display: inline-block;">You received this because you have items saved in your FreshCart basket.</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `;
        } else {
            // Generic email format
            subject = req.body.subject || 'Notification from FreshCart';
            htmlContent = req.body.html || `<p>${req.body.message || 'You have a new message from FreshCart.'}</p>`;
        }

        // Send transactional email via Brevo REST API v3
        const brevoPayload = {
            sender: {
                name: senderName,
                email: senderEmail
            },
            to: [
                {
                    email: to,
                    name: name || to.split('@')[0]
                }
            ],
            subject: subject,
            htmlContent: htmlContent
        };

        const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(brevoPayload)
        });

        const data = await brevoResponse.json();

        if (!brevoResponse.ok) {
            console.error('Brevo API Error:', data);
            return res.status(brevoResponse.status).json({
                success: false,
                error: data.message || 'Failed to send email via Brevo.',
                details: data
            });
        }

        return res.status(200).json({
            success: true,
            messageId: data.messageId,
            message: 'Email sent successfully via Brevo!'
        });
    } catch (err) {
        console.error('Internal Error in send-email handler:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal Server Error'
        });
    }
}

