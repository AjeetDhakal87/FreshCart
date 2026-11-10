// Vercel Serverless Function: Brevo Contact Sync & Welcome Automation
// Route: POST /api/subscribe-user

export default async function handler(req, res) {
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
        return res.status(500).json({ success: false, error: 'Brevo service is not configured on the server.' });
    }

    try {
        const { email, firstName, lastName, phone, couponCode, listId = 6 } = req.body || {};

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email address is required.' });
        }

        // Clean & format attributes
        const attributes = {};
        if (firstName) attributes.FIRSTNAME = firstName.trim();
        if (lastName) attributes.LASTNAME = lastName.trim();
        if (couponCode) attributes.COUPON_CODE = couponCode.toString().trim().toUpperCase();

        // Format phone number to E.164 standard (Brevo requires international format for SMS attribute)
        if (phone) {
            let cleanedPhone = phone.toString().replace(/[\s\-\(\)]/g, '');
            if (cleanedPhone.startsWith('+')) {
                attributes.SMS = cleanedPhone;
            } else if (/^9[0-9]{9}$/.test(cleanedPhone)) {
                // Nepal standard 10-digit mobile number starting with 9
                attributes.SMS = `+977${cleanedPhone}`;
            } else if (/^[0-9]{10,14}$/.test(cleanedPhone)) {
                attributes.SMS = `+${cleanedPhone}`;
            }
        }

        const brevoPayload = {
            email: email.trim().toLowerCase(),
            attributes: attributes,
            listIds: [Number(listId)],
            updateEnabled: true
        };

        const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(brevoPayload)
        });

        const data = await brevoResponse.json().catch(() => ({}));

        // Send Welcome Transactional Email with Unique Coupon Code
        if (req.body?.sendWelcomeEmail !== false) {
            try {
                const customerName = firstName ? `${firstName} ${lastName || ''}`.trim() : 'Valued Customer';
                const code = couponCode || attributes.COUPON_CODE || 'WELCOME10';
                const senderEmail = process.env.BREVO_SENDER_EMAIL || 'ajeetdhakal9867165189@gmail.com';

                await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'api-key': apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        sender: { name: 'FreshCart', email: senderEmail },
                        to: [{ email: email.trim().toLowerCase(), name: customerName }],
                        subject: `Welcome to FreshCart! Here is your exclusive 10% coupon: ${code}`,
                        htmlContent: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px; color: #2d3748; }
                                .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
                                .header { background: linear-gradient(135deg, #60BB46, #489e32); padding: 32px 24px; text-align: center; color: #ffffff; }
                                .header h1 { margin: 0; font-size: 26px; font-weight: 800; }
                                .header p { margin: 8px 0 0; opacity: 0.95; font-size: 15px; }
                                .content { padding: 30px 24px; text-align: center; }
                                .welcome-badge { display: inline-block; background-color: #ebfbee; color: #2b8a3e; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
                                .coupon-box { background: #f0fdf4; border: 2px dashed #60BB46; border-radius: 12px; padding: 20px; margin: 24px 0; }
                                .coupon-label { font-size: 12px; text-transform: uppercase; color: #2b8a3e; font-weight: 700; letter-spacing: 1px; }
                                .coupon-code { font-size: 28px; font-weight: 900; color: #276749; letter-spacing: 3px; margin: 8px 0; font-family: monospace; }
                                .coupon-desc { font-size: 13px; color: #4a5568; margin: 0; }
                                .btn { display: inline-block; background-color: #60BB46; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 50px; font-weight: 700; margin-top: 16px; font-size: 15px; }
                                .footer { text-align: center; padding: 20px; font-size: 12px; color: #a0aec0; }
                            </style>
                        </head>
                        <body>
                            <div class="card">
                                <div class="header">
                                    <h1>FreshCart</h1>
                                    <p>Farm Fresh Groceries at Your Doorstep</p>
                                </div>
                                <div class="content">
                                    <div class="welcome-badge">Welcome to FreshCart</div>
                                    <h2 style="margin: 0 0 12px; color: #2d3748;">Hello ${customerName}!</h2>
                                    <p style="color: #4a5568; line-height: 1.6; margin: 0 0 16px;">We're thrilled to have you with us. As a special gift for joining, enjoy <strong>10% OFF</strong> your very first order with your personalized coupon code below:</p>

                                    <div class="coupon-box">
                                        <div class="coupon-label">Your Personal First-Order Coupon</div>
                                        <div class="coupon-code">${code}</div>
                                        <p class="coupon-desc">10% OFF on your entire first purchase • Enter code at checkout</p>
                                    </div>

                                    <a href="https://freshcart-theta-indol.vercel.app/products.html" class="btn">Start Shopping Now</a>
                                </div>
                                <div class="footer">
                                    © ${new Date().getFullYear()} FreshCart Store. All rights reserved.<br>
                                    Need help? Reach us at support@freshcart.store
                                </div>
                            </div>
                        </body>
                        </html>
                        `
                    })
                });
            } catch (emailErr) {
                console.warn('Welcome email dispatch non-blocking error:', emailErr);
            }
        }

        // Status 201 (Created) or 204 (Updated) or 200 means success
        if (brevoResponse.ok || brevoResponse.status === 201 || brevoResponse.status === 204) {
            return res.status(200).json({
                success: true,
                message: 'Contact added to Brevo "New user" list successfully! Automation triggered.',
                data
            });
        }

        // If duplicate contact already exists, Brevo might return duplicate_parameter
        if (data.code === 'duplicate_parameter') {
            return res.status(200).json({
                success: true,
                message: 'Contact already exists and was updated in "New user" list.',
                data
            });
        }

        console.error('Brevo API Contact Error:', data);
        return res.status(brevoResponse.status || 400).json({
            success: false,
            error: data.message || 'Failed to add contact in Brevo.',
            details: data
        });
    } catch (err) {
        console.error('Internal Error in subscribe-user handler:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal Server Error'
        });
    }
}
