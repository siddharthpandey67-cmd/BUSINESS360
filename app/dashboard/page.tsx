
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

type Org = {
  id: string;
  name: string;
};

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
  grand_total: number;
  status: string;
  created_at: string;
  customer_id: string | null;
};

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
};

export default function Dashboard() {
  const sb = getSupabase();

  const [org, setOrg] = useState<Org | null>(null);
  const [email, setEmail] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [tab, setTab] = useState("Overview");
  const [notice, setNotice] = useState("Loading your workspace...");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [expenseCategory, setExpenseCategory] = useState("Other");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  const [expenseDate, setExpenseDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  async function load() {
    const {
      data: { user },
      error: authError
    } = await sb.auth.getUser();

    if (authError) {
      setNotice(authError.message);
      return;
    }

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

    const [p, c, i, ex] = await Promise.all([
      sb.from("products")
        .select("id,name,sku,selling_price,stock_quantity")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false }),

      sb.from("customers")
        .select("id,name,phone,email")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false }),

      sb.from("invoices")
        .select("id,invoice_number,grand_total,status,created_at,customer_id")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false }),

      sb.from("expenses")
        .select("id,category,description,amount,expense_date,created_at")
        .eq("organization_id", currentOrg.id)
        .order("expense_date", { ascending: false })
    ]);

    if (p.error) {
      setNotice("Products error: " + p.error.message);
      return;
    }

    if (c.error) {
      setNotice("Customers error: " + c.error.message);
      return;
    }

    if (i.error) {
      setNotice("Invoices error: " + i.error.message);
      return;
    }

    if (ex.error) {
      setNotice("Expenses error: " + ex.error.message);
      return;
    }

    setProducts((p.data || []) as Product[]);
    setCustomers((c.data || []) as Customer[]);
    setInvoices((i.data || []) as Invoice[]);
    setExpenses((ex.data || []) as Expense[]);
    setNotice("");
  }

  useEffect(() => {
    load();
  }, []);

  async function addProduct(e: FormEvent) {
    e.preventDefault();

    if (!org) return;

    if (Number(price) < 0 || Number(stock) < 0) {
      setNotice("Price and stock cannot be negative.");
      return;
    }

    setBusy(true);
    setNotice("");

    const { error } = await sb.from("products").insert({
      organization_id: org.id,
      name: name.trim(),
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
      name: customerName.trim(),
      phone: customerPhone.trim() || null,
      email: customerEmail.trim() || null
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

  function startEditExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setExpenseCategory(expense.category || "Other");
    setExpenseDescription(expense.description);
    setExpenseAmount(String(expense.amount));
    setExpenseDate(expense.expense_date);
    setNotice("Editing expense. Update the fields and save changes.");
  }

  function cancelEditExpense() {
    setEditingExpenseId(null);
    setExpenseCategory("Other");
    setExpenseDescription("");
    setExpenseAmount("");

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    setExpenseDate(`${year}-${month}-${day}`);
    setNotice("");
  }

  async function updateExpense(e: FormEvent) {
    e.preventDefault();

    if (!org || !editingExpenseId) return;

    const amountValue = Number(expenseAmount);

    if (!expenseDescription.trim()) {
      setNotice("Please enter an expense description.");
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setNotice("Please enter a valid expense amount.");
      return;
    }

    if (!expenseDate) {
      setNotice("Please select an expense date.");
      return;
    }

    setBusy(true);
    setNotice("");

    const { error } = await sb
      .from("expenses")
      .update({
        category: expenseCategory,
        description: expenseDescription.trim(),
        amount: amountValue,
        expense_date: expenseDate
      })
      .eq("id", editingExpenseId)
      .eq("organization_id", org.id);

    if (error) {
      setNotice("Could not update expense: " + error.message);
    } else {
      setEditingExpenseId(null);
      setExpenseCategory("Other");
      setExpenseDescription("");
      setExpenseAmount("");

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");

      setExpenseDate(`${year}-${month}-${day}`);

      await load();
      setNotice("Expense updated successfully.");
    }

    setBusy(false);
  }

  async function deleteExpense(expense: Expense) {
    if (!org) return;

    const confirmed = window.confirm(
      `Delete this expense?\n\n${expense.description} — ₹${Number(expense.amount).toFixed(2)}`
    );

    if (!confirmed) return;

    setBusy(true);
    setNotice("");

    const { error } = await sb
      .from("expenses")
      .delete()
      .eq("id", expense.id)
      .eq("organization_id", org.id);

    if (error) {
      setNotice("Could not delete expense: " + error.message);
    } else {
      if (editingExpenseId === expense.id) {
        cancelEditExpense();
      }

      await load();
      setNotice("Expense deleted successfully.");
    }

    setBusy(false);
  }

  async function addExpense(e: FormEvent) {
    e.preventDefault();

    if (!org) return;

    const amountValue = Number(expenseAmount);

    if (!expenseDescription.trim()) {
      setNotice("Please enter an expense description.");
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setNotice("Please enter a valid expense amount.");
      return;
    }

    if (!expenseDate) {
      setNotice("Please select an expense date.");
      return;
    }

    setBusy(true);
    setNotice("");

    const { error } = await sb.from("expenses").insert({
      organization_id: org.id,
      category: expenseCategory,
      description: expenseDescription.trim(),
      amount: amountValue,
      expense_date: expenseDate
    });

    if (error) {
      setNotice("Could not save expense: " + error.message);
    } else {
      setExpenseCategory("Other");
      setExpenseDescription("");
      setExpenseAmount("");

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");

      setExpenseDate(`${year}-${month}-${day}`);

      await load();
      setNotice("Expense saved successfully.");
    }

    setBusy(false);
  }

  async function createInvoice(e: FormEvent) {
    e.preventDefault();

    if (!org) return;

    const product = products.find(p => p.id === selectedProduct);
    const qty = Number(quantity);

    if (!product) {
      setNotice("Please select a product.");
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setNotice("Enter a valid whole-number quantity.");
      return;
    }

    if (qty > Number(product.stock_quantity)) {
      setNotice("Quantity is greater than available stock.");
      return;
    }

    const total = Number(product.selling_price) * qty;
    const invoiceNumber = "BI-" + Date.now();

    setBusy(true);
    setNotice("");

    const { data: invoice, error: invoiceError } = await sb
      .from("invoices")
      .insert({
        organization_id: org.id,
        customer_id: selectedCustomer || null,
        invoice_number: invoiceNumber,
        subtotal: total,
        tax_total: 0,
        grand_total: total,
        status: "draft"
      })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      setNotice(invoiceError?.message || "Invoice could not be created.");
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
      setNotice(
        "Invoice item could not be saved. Invoice ID: " +
        invoice.id +
        ". Error: " +
        itemError.message
      );
      setBusy(false);
      return;
    }

    const { error: updateError } = await sb
      .from("invoices")
      .update({ status: "issued" })
      .eq("id", invoice.id);

    setSelectedProduct("");
    setSelectedCustomer("");
    setQuantity("1");

    await load();

    if (updateError) {
      setNotice("Invoice created, but status update failed: " + updateError.message);
    } else {
      setNotice("Invoice created successfully: " + invoiceNumber);
    }

    setBusy(false);
  }

  function printInvoice(invoice: Invoice) {
    const customer = customers.find(
      c => c.id === invoice.customer_id
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 35px;
            color: #222;
          }
          h1 { color: #2563eb; }
          .line {
            border-bottom: 1px solid #ddd;
            padding: 12px 0;
          }
          .total {
            font-size: 22px;
            font-weight: bold;
            margin-top: 25px;
          }
        </style>
      </head>
      <body>
        <h1>BUSINESS360</h1>
        <h2>INVOICE</h2>
        <p>Invoice: ${invoice.invoice_number}</p>
        <p>Date: ${new Date(invoice.created_at).toLocaleDateString("en-IN")}</p>
        <div class="line">
          Customer: ${customer?.name || "Walk-in Customer"}
        </div>
        <div class="line">Status: ${invoice.status}</div>
        <div class="total">
          Total: ₹${Number(invoice.grand_total).toFixed(2)}
        </div>
        <p>Thank you for your business!</p>
      </body>
      </html>
    `;

    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";
    frame.style.border = "0";

    document.body.appendChild(frame);

    const frameWindow = frame.contentWindow;
    const frameDocument = frame.contentDocument;

    if (!frameWindow || !frameDocument) {
      frame.remove();
      setNotice("Unable to prepare invoice for printing.");
      return;
    }

    frame.onload = () => {
      frameWindow.addEventListener(
        "afterprint",
        () => frame.remove(),
        { once: true }
      );

      frameWindow.focus();
      frameWindow.print();

      window.setTimeout(() => {
        if (frame.isConnected) {
          frame.remove();
        }
      }, 60000);
    };

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();
  }

  async function logout() {
    await sb.auth.signOut();
    window.location.href = "/";
  }

  const totalSales = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.grand_total || 0),
    0
  );

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const estimatedBalance = totalSales - totalExpenses;

  const now = new Date();

  const currentMonth =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthlyExpenses = expenses
    .filter(expense => expense.expense_date?.slice(0, 7) === currentMonth)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">
            BUSINESS<span>360</span>
          </div>
          <div className="tag">YOUR BUSINESS WORKSPACE</div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {email}
          </span>
          <button className="btn ghost" onClick={logout}>
            Logout
          </button>
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

          <h1 className="h1">
            {org?.name || "Your dashboard"}
          </h1>

          <p className="muted">
            Manage your business from one place.
          </p>

          {notice && (
            <div className="notice">{notice}</div>
          )}

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
                  <div className="metric">
                    ₹{totalSales.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Welcome to BUSINESS360</h3>
                <p className="muted">
                  Manage products, customers and billing from one workspace.
                </p>
                <button
                  className="btn"
                  onClick={() => setTab("Products")}
                >
                  Add your first product
                </button>
              </div>
            </>
          )}

          {tab === "Products" && (
            <>
              <div className="section">
                <h2>Products & inventory</h2>
                <span className="pill">
                  {products.length} products
                </span>
              </div>

              <form className="card" onSubmit={addProduct}>
                <h3>Add product</h3>

                <div className="two">
                  <div>
                    <label>Product name</label>
                    <input
                      className="field"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Product name"
                    />
                  </div>

                  <div>
                    <label>Selling price (₹)</label>
                    <input
                      className="field"
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label>Opening stock</label>
                    <input
                      className="field"
                      required
                      type="number"
                      min="0"
                      step="0.001"
                      value={stock}
                      onChange={e => setStock(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <button className="btn" disabled={busy}>
                  {busy ? "Saving..." : "Save product"}
                </button>
              </form>

              <div className="section">
                <h3>Product list</h3>
              </div>

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
                        <td>
                          ₹{Number(p.selling_price).toFixed(2)}
                        </td>
                        <td>{p.stock_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!products.length && (
                  <div className="empty">
                    No products yet. Add your first product.
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "Customers" && (
            <>
              <div className="section">
                <h2>Customer management</h2>
                <span className="pill">
                  {customers.length} customers
                </span>
              </div>

              <form className="card" onSubmit={addCustomer}>
                <h3>Add customer</h3>

                <div className="two">
                  <div>
                    <label>Customer name</label>
                    <input
                      className="field"
                      required
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Customer name"
                    />
                  </div>

                  <div>
                    <label>Phone number</label>
                    <input
                      className="field"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="Phone number"
                    />
                  </div>

                  <div>
                    <label>Email</label>
                    <input
                      className="field"
                      type="email"
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <button className="btn" disabled={busy}>
                  {busy ? "Saving..." : "Save customer"}
                </button>
              </form>

              <div className="section">
                <h3>Customer list</h3>
              </div>

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
                  <div className="empty">
                    No customers added yet.
                  </div>
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
                    <select
                      className="field"
                      value={selectedCustomer}
                      onChange={e => setSelectedCustomer(e.target.value)}
                    >
                      <option value="">Walk-in customer</option>

                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label>Select product</label>
                    <select
                      className="field"
                      required
                      value={selectedProduct}
                      onChange={e => setSelectedProduct(e.target.value)}
                    >
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
                    <input
                      className="field"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                    />
                  </div>
                </div>

                {selectedProduct && (
                  <p className="muted">
                    Total: ₹
                    {(
                      Number(
                        products.find(p => p.id === selectedProduct)
                          ?.selling_price || 0
                      ) * Number(quantity || 0)
                    ).toFixed(2)}
                  </p>
                )}

                <button
                  className="btn"
                  disabled={busy || !products.length}
                >
                  {busy ? "Creating..." : "Create invoice"}
                </button>
              </form>

              <div className="section">
                <h3>Sales history</h3>
                <span className="pill">
                  {invoices.length} invoices
                </span>
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
                        <td>
                          {new Date(inv.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td>
                          ₹{Number(inv.grand_total).toFixed(2)}
                        </td>
                        <td>{inv.status}</td>
                        <td>
                          <button
                            className="btn ghost"
                            onClick={() => printInvoice(inv)}
                          >
                            Print / PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!invoices.length && (
                  <div className="empty">
                    No invoices created yet.
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "Inventory" && (
            <div className="card">
              <h2>Inventory</h2>
              <p className="muted">
                Current stock levels.
              </p>

              {products.map(p => (
                <p key={p.id}>
                  {p.name}: {p.stock_quantity} units
                </p>
              ))}
            </div>
          )}

          {tab === "Expenses" && (
            <>
              <div className="section">
                <h2>Expense management</h2>
                <span className="pill">{expenses.length} records</span>
              </div>

              <div className="grid">
                <div className="card">
                  <div className="muted">Total expenses</div>
                  <div className="metric">₹{totalExpenses.toFixed(2)}</div>
                </div>

                <div className="card">
                  <div className="muted">This month's expenses</div>
                  <div className="metric">₹{monthlyExpenses.toFixed(2)}</div>
                </div>
              </div>

              <form
                className="card"
                onSubmit={editingExpenseId ? updateExpense : addExpense}
              >
                <h3>
                  {editingExpenseId ? "Edit expense" : "Add new expense"}
                </h3>

                <div className="two">
                  <div>
                    <label>Expense category</label>
                    <select
                      className="field"
                      value={expenseCategory}
                      onChange={e => setExpenseCategory(e.target.value)}
                    >
                      <option value="Rent">Rent</option>
                      <option value="Electricity">Electricity</option>
                      <option value="Salary">Salary</option>
                      <option value="Transport">Transport</option>
                      <option value="Internet">Internet</option>
                      <option value="Purchases">Purchases</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label>Amount (₹)</label>
                    <input
                      className="field"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={expenseAmount}
                      onChange={e => setExpenseAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>

                  <div>
                    <label>Expense date</label>
                    <input
                      className="field"
                      type="date"
                      required
                      value={expenseDate}
                      onChange={e => setExpenseDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Description</label>
                    <input
                      className="field"
                      required
                      maxLength={250}
                      value={expenseDescription}
                      onChange={e => setExpenseDescription(e.target.value)}
                      placeholder="e.g. Shop electricity bill"
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" disabled={busy}>
                    {busy
                      ? "Please wait..."
                      : editingExpenseId
                        ? "Update expense"
                        : "Save expense"}
                  </button>

                  {editingExpenseId && (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={cancelEditExpense}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="section">
                <h3>Expense history</h3>
              </div>

              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenses.map(expense => (
                      <tr key={expense.id}>
                        <td>
                          {new Date(
                            `${expense.expense_date}T00:00:00`
                          ).toLocaleDateString("en-IN")}
                        </td>
                        <td>{expense.category}</td>
                        <td>{expense.description}</td>
                        <td>₹{Number(expense.amount).toFixed(2)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => startEditExpense(expense)}
                              disabled={busy}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => deleteExpense(expense)}
                              disabled={busy}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!expenses.length && (
                  <div className="empty">
                    No expenses recorded yet. Add your first expense above.
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "Reports" && (
            <div className="card">
              <h2>Business Reports</h2>

              <p>Total invoices: {invoices.length}</p>
              <p>Total sales: ₹{totalSales.toFixed(2)}</p>
              <p>Total expenses: ₹{totalExpenses.toFixed(2)}</p>

              <div className="section">
                <h3>Estimated balance after recorded expenses</h3>
                <div className="metric">
                  ₹{estimatedBalance.toFixed(2)}
                </div>
              </div>

              <p>Total products: {products.length}</p>
              <p>Total customers: {customers.length}</p>

              <p className="muted">
                Note: This is a simple estimate (sales minus entered expenses).
                It is not accounting net profit because product purchase costs,
                taxes and other adjustments may not be included.
              </p>
            </div>
          )}

        </section>
      </div>
    </main>
  );
}
