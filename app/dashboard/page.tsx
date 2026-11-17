
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

type Org = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number;
  stock_quantity: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  customer_id: string | null;
};

export default function Dashboard() {
  const sb = getSupabase();

  const [org, setOrg] = useState<Org | null>(null);
  const [email, setEmail] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [tab, setTab] = useState("Overview");
  const [notice, setNotice] = useState("Loading your workspace...");
  const [busy, setBusy] = useState(false);

  // Product form
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  // Customer form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Billing form
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");

  async function load() {
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setEmail(user.email || "");

    const { data: orgs, error: orgError } = await sb
      .from("organizations")
      .select("id,name")
      .order("created_at", { ascending: true })
      .limit(1);

    if (orgError) {
      setNotice(orgError.message);
      return;
    }

    if (!orgs?.length) {
      setNotice("No business workspace found.");
      return;
    }

    const currentOrg = orgs[0] as Org;
    setOrg(currentOrg);

    const [p, c, i] = await Promise.all([
      sb.from("products")
        .select("id,name,sku,selling_price,stock_quantity")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false }),

      sb.from("customers")
        .select("id,name,phone,email")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false }),

      sb.from("invoices")
        .select("id,invoice_number,total_amount,status,created_at,customer_id")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false })
    ]);

    if (p.error) {
      setNotice(p.error.message);
      return;
    }

    if (c.error) {
      setNotice("Customer loading error: " + c.error.message);
      return;
    }

    if (i.error) {
      setNotice("Invoice loading error: " + i.error.message);
      return;
    }

    setProducts((p.data || []) as Product[]);
    setCustomers((c.data || []) as Customer[]);
    setInvoices((i.data || []) as Invoice[]);
    setNotice("");
  }

  useEffect(() => {
    load();
  }, []);

  async function addProduct(e: FormEvent) {
    e.preventDefault();
    if (!org) return;

    setBusy(true);
    setNotice("");

    const { error } = await sb.from("products").insert({
      organization_id: org.id,
      name,
      selling_price: Number(price),
      stock_quantity: Number(stock)
    });

    if (error) {
      setNotice(error.message);
    } else {
      setName("");
      setPrice("");
      setStock("");
      await load();
      setNotice("Product saved successfully.");
    }

    setBusy(false);
  }

  async function addCustomer(e: FormEvent) {
    e.preventDefault();
    if (!org) return;

    setBusy(true);
    setNotice("");

    const { error } = await sb.from("customers").insert({
      organization_id: org.id,
      name: customerName,
      phone: customerPhone || null,
      email: customerEmail || null
    });

    if (error) {
      setNotice(error.message);
    } else {
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      await load();
      setNotice("Customer added successfully.");
    }

    setBusy(false);
  }

  async function createInvoice(e: FormEvent) {
    e.preventDefault();

    if (!org) return;

    const product = products.find(p => p.id === selectedProduct);
    const qty = Number(quantity);

    if (!product || qty <= 0) {
      setNotice("Please select a product and valid quantity.");
      return;
    }

    if (qty > Number(product.stock_quantity)) {
      setNotice("Quantity is greater than available stock.");
      return;
    }

    setBusy(true);
    setNotice("");

    const total = Number(product.selling_price) * qty;
    const invoiceNumber = "BI-" + Date.now();

    const { data: invoice, error } = await sb
      .from("invoices")
      .insert({
        organization_id: org.id,
        customer_id: selectedCustomer || null,
        invoice_number: invoiceNumber,
        total_amount: total,
        status: "draft"
      })
      .select("id")
      .single();

    if (error || !invoice) {
      setNotice(error?.message || "Invoice could not be created.");
      setBusy(false);
      return;
    }

    const { error: itemError } = await sb
      .from("invoice_items")
      .insert({
        invoice_id: invoice.id,
        product_id: product.id,
        description: product.name,
        quantity: qty,
        unit_price: Number(product.selling_price),
        line_total: total
      });

    if (itemError) {
      await sb.from("invoices")
        .delete()
        .eq("id", invoice.id);

      setNotice(itemError.message);
      setBusy(false);
      return;
    }

    const { error: updateError } = await sb
      .from("invoices")
      .update({ status: "issued" })
      .eq("id", invoice.id);

    if (updateError) {
      setNotice("Invoice saved, but status update failed: " + updateError.message);
    } else {
      setNotice("Invoice created successfully: " + invoiceNumber);
    }

    setSelectedProduct("");
    setSelectedCustomer("");
    setQuantity("1");

    await load();
    setBusy(false);
  }

  function printInvoice(invoice: Invoice) {
    const customer = customers.find(c => c.id === invoice.customer_id);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          body { font-family: Arial; padding: 35px; color: #222; }
          h1 { color: #2563eb; }
          .line { border-bottom: 1px solid #ddd; padding: 12px 0; }
          .total { font-size: 22px; font-weight: bold; margin-top: 25px; }
        </style>
      </head>
      <body>
        <h1>BUSINESS360</h1>
        <h2>INVOICE</h2>
        <p>Invoice: ${invoice.invoice_number}</p>
        <p>Date: ${new Date(invoice.created_at).toLocaleDateString("en-IN")}</p>
        <div class="line">Customer: ${customer?.name || "Walk-in Customer"}</div>
        <div class="line">Status: ${invoice.status}</div>
        <div class="total">Total: ₹${Number(invoice.total_amount).toFixed(2)}</div>
        <p>Thank you for your business!</p>
      </body>
      </html>
    `;

    const win = window.open("", "_blank");

    if (!win) {
      setNotice("Please allow pop-ups in your browser to print invoices.");
      return;
    }

    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  async function logout() {
    await sb.auth.signOut();
    window.location.href = "/";
  }

  const totalSales = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.total_amount || 0),
    0
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">BUSINESS<span>360</span></div>
          <div className="tag">YOUR BUSINESS WORKSPACE</div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12 }}>{email}</span>
          <button className="btn ghost" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          {[
            "Overview",
            "Products",
            "Customers",
            "Sales & invoices",
            "Inventory",
            "Expenses",
            "Reports",
            "Team & settings"
          ].map(x => (
            <button
              key={x}
              className={`navbtn ${tab === x ? "active" : ""}`}
              onClick={() => setTab(x)}
            >
              {x}
            </button>
          ))}
        </aside>

        <section className="main">
          <div className="eyebrow">BUSINESS WORKSPACE</div>
          <h1 className="h1">{org?.name || "Your dashboard"}</h1>

          <p className="muted">
            Manage your business from one place.
          </p>

          {notice && <div className="notice">{notice}</div>}

          {tab === "Overview" && (
            <>
              <div className="grid">
                <div className="card">
                  <div className="muted">Products</div>
                  <div className="metric">{products.length}</div>
                </div>

                <div className="card">
                  <div className="muted">Customers</div>
                  <div className="metric">{customers.length}</div>
                </div>

                <div className="card">
                  <div className="muted">Invoices</div>
                  <div className="metric">{invoices.length}</div>
                </div>

                <div className="card">
                  <div className="muted">Total sales</div>
                  <div className="metric">₹{totalSales.toFixed(2)}</div>
                </div>
              </div>

              <div className="card">
                <h3>Welcome to BUSINESS360</h3>
                <p className="muted">
                  Manage products, customers and billing from your workspace.
                </p>
                <button className="btn" onClick={() => setTab("Products")}>
                  Add your first product
                </button>
              </div>
            </>
          )}

          {tab === "Products" && (
            <>
              <div className="section">
                <h2>Products & inventory</h2>
                <span className="pill">{products.length} products</span>
              </div>

              <form className="card" onSubmit={addProduct}>
                <h3>Add product</h3>

                <div className="two">
                  <div>
                    <label>Product name</label>
                    <input className="field" required value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Product name" />
                  </div>

                  <div>
                    <label>Selling price (₹)</label>
                    <input className="field" required type="number"
                      min="0" step="0.01" value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.00" />
                  </div>

                  <div>
                    <label>Opening stock</label>
                    <input className="field" required type="number"
                      min="0" step="0.001" value={stock}
                      onChange={e => setStock(e.target.value)}
                      placeholder="0" />
                  </div>
                </div>

                <button className="btn" disabled={busy}>
                  {busy ? "Saving..." : "Save product"}
                </button>
              </form>

              <div className="section"><h3>Product list</h3></div>

              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Price</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.sku || "—"}</td>
                        <td>₹{Number(p.selling_price).toFixed(2)}</td>
                        <td>{p.stock_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!products.length && (
                  <div className="empty">No products yet.</div>
                )}
              </div>
            </>
          )}

          {tab === "Customers" && (
            <>
              <div className="section">
                <h2>Customer management</h2>
                <span className="pill">{customers.length} customers</span>
              </div>

              <form className="card" onSubmit={addCustomer}>
                <h3>Add customer</h3>

                <div className="two">
                  <div>
                    <label>Customer name</label>
                    <input className="field" required value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Customer name" />
                  </div>

                  <div>
                    <label>Phone number</label>
                    <input className="field" value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="Phone number" />
                  </div>

                  <div>
                    <label>Email</label>
                    <input className="field" type="email" value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      placeholder="Email address" />
                  </div>
                </div>

                <button className="btn" disabled={busy}>
                  {busy ? "Saving..." : "Save customer"}
                </button>
              </form>

              <div className="section"><h3>Customer list</h3></div>

              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.phone || "—"}</td>
                        <td>{c.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!customers.length && (
                  <div className="empty">No customers added yet.</div>
                )}
              </div>
            </>
          )}

          {tab === "Sales & invoices" && (
            <>
              <div className="section">
                <h2>Billing & invoices</h2>
              </div>

              <form className="card" onSubmit={createInvoice}>
                <h3>Create new invoice</h3>

                <div className="two">
                  <div>
                    <label>Select customer</label>
                    <select className="field" value={selectedCustomer}
                      onChange={e => setSelectedCustomer(e.target.value)}>
                      <option value="">Walk-in customer</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label>Select product</label>
                    <select className="field" required value={selectedProduct}
                      onChange={e => setSelectedProduct(e.target.value)}>
                      <option value="">Choose product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ₹{p.selling_price}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label>Quantity</label>
                    <input className="field" type="number" min="1"
                      required value={quantity}
                      onChange={e => setQuantity(e.target.value)} />
                  </div>
                </div>

                {selectedProduct && (
                  <p className="muted">
                    Total: ₹{(
                      Number(products.find(p => p.id === selectedProduct)?.selling_price || 0)
                      * Number(quantity || 0)
                    ).toFixed(2)}
                  </p>
                )}

                <button className="btn" disabled={busy || !products.length}>
                  {busy ? "Creating..." : "Create invoice"}
                </button>
              </form>

              <div className="section">
                <h3>Sales history</h3>
                <span className="pill">{invoices.length} invoices</span>
              </div>

              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id}>
                        <td>{inv.invoice_number}</td>
                        <td>{new Date(inv.created_at).toLocaleDateString("en-IN")}</td>
                        <td>₹{Number(inv.total_amount).toFixed(2)}</td>
                        <td>{inv.status}</td>
                        <td>
                          <button className="btn ghost"
                            onClick={() => printInvoice(inv)}>
                            Print / PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!invoices.length && (
                  <div className="empty">No invoices created yet.</div>
                )}
              </div>
            </>
          )}

          {tab === "Inventory" && (
            <div className="card">
              <h2>Inventory</h2>
              <p className="muted">
                Current stock levels are shown below.
              </p>
              {products.map(p => (
                <p key={p.id}>
                  {p.name}: {p.stock_quantity} units
                </p>
              ))}
            </div>
          )}

          {tab === "Expenses" && (
            <div className="card">
              <h2>Expenses</h2>
              <p className="muted">
                Expense tracking will be added in a later update.
              </p>
            </div>
          )}

          {tab === "Reports" && (
            <div className="card">
              <h2>Reports</h2>
              <p>Total invoices: {invoices.length}</p>
              <p>Total sales: ₹{totalSales.toFixed(2)}</p>
              <p>Total products: {products.length}</p>
              <p>Total customers: {customers.length}</p>
            </div>
          )}

          {tab === "Team & settings" && (
            <div className="card">
              <h2>Team & settings</h2>
              <p className="muted">
                Team management and workspace settings will be added later.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
