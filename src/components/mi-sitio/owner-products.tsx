"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { formatGs } from "@/lib/format";
import { PRODUCTS_MAX } from "@/lib/product-form";
import type { ProductRow } from "@/db/product-queries";
import type { ProductFormState } from "@/app/mi-sitio/product-actions";
import { ItemImageField } from "./item-image";

/**
 * Produktredigeraren i owner-panelen (PR-14). Spanska (voseo) — kundens yta.
 *
 * Samma form som menyn (owner-menu.tsx): ett fält per sak, inga modaler,
 * ingen drag-and-drop. Produkter har ingen sektionsnivå — en enda lista, med
 * ett tak på 60 i stället för menyns 12 sektioner × 40 rätter.
 */

function Submit({ label, busy = "Guardando…" }: { label: string; busy?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="panel-btn">
      {pending ? busy : label}
    </button>
  );
}

function ProductForm({
  product,
  save,
  onDone,
}: {
  product?: ProductRow;
  save: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState<ProductFormState, FormData>(async (prev, formData) => {
    const result = await save(prev, formData);
    if (result.ok && onDone) onDone();
    return result;
  }, {});

  const idSuffix = product?.id ?? "new";

  return (
    <form action={formAction} className="panel-menu-form">
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      {state.error ? <p className="panel-note panel-note--err">{state.error}</p> : null}

      <div className="panel-field">
        <label htmlFor={`product-name-${idSuffix}`}>Nombre</label>
        <input
          id={`product-name-${idSuffix}`}
          name="name"
          type="text"
          defaultValue={product?.name ?? ""}
          maxLength={120}
          required
        />
      </div>

      <div className="panel-field">
        <label htmlFor={`product-desc-${idSuffix}`}>Detalle (opcional)</label>
        <input
          id={`product-desc-${idSuffix}`}
          name="description"
          type="text"
          defaultValue={product?.description ?? ""}
          maxLength={300}
        />
      </div>

      <div className="panel-field">
        <label htmlFor={`product-price-${idSuffix}`}>Precio en guaraníes</label>
        <input
          id={`product-price-${idSuffix}`}
          name="priceGs"
          type="text"
          inputMode="numeric"
          defaultValue={product?.priceGs != null ? String(product.priceGs) : ""}
          placeholder="45000"
        />
        <p className="hint">Dejalo vacío y en tu página va a decir “A consultar”.</p>
      </div>

      <label className="panel-check">
        <input type="checkbox" name="isVisible" defaultChecked={product ? product.isVisible : true} />
        Visible en la página
      </label>

      <div className="panel-actions">
        <Submit label={product ? "Guardar producto" : "Agregar producto"} />
      </div>
    </form>
  );
}

export function OwnerProducts({
  products,
  saveProduct,
  deleteProduct,
  toggleVisibility,
  moveProduct,
  removeImage,
  heading = "Tus productos",
  businessId,
}: {
  products: ProductRow[];
  saveProduct: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  deleteProduct: (formData: FormData) => Promise<void>;
  toggleVisibility: (formData: FormData) => Promise<void>;
  moveProduct: (formData: FormData) => Promise<void>;
  removeImage: (formData: FormData) => Promise<void>;
  /** Rubriken; adminet (R3-20) talar inte i kundens "tu". */
  heading?: string;
  /** Skickas med bilduppladdningen när superadmin redigerar från /admin. */
  businessId?: number;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="panel-card">
      <h2>{heading}</h2>
      <p>
        Lo que cargues acá sale en tu página con el precio al lado. Los productos marcados como “no visible”
        desaparecen de la página, pero quedan guardados acá para cuando vuelvan.
      </p>

      {products.length === 0 ? (
        <p className="hint">Todavía no cargaste productos.</p>
      ) : (
        <ul className="panel-menu-items">
          {products.map((product, i) => (
            <li key={product.id} className={product.isVisible ? undefined : "is-off"}>
              <div className="panel-menu-item">
                <span className="name">{product.name}</span>
                <span className="price">{formatGs(product.priceGs)}</span>
              </div>
              {product.description ? <p className="hint">{product.description}</p> : null}
              <ItemImageField
                kind="product"
                targetId={product.id}
                idField="productId"
                name={product.name}
                image={product.image}
                removeImage={removeImage}
                businessId={businessId}
              />
              <div className="panel-menu-item-actions">
                <form action={toggleVisibility}>
                  <input type="hidden" name="productId" value={product.id} />
                  <button type="submit">{product.isVisible ? "Ocultar" : "Mostrar"}</button>
                </form>
                <button
                  type="button"
                  onClick={() => setEditing(editing === product.id ? null : product.id)}
                >
                  {editing === product.id ? "Cerrar" : "Editar"}
                </button>
                <span className="panel-photo-order">
                  <form action={moveProduct}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={i === 0} aria-label={`Subir ${product.name}`}>
                      ↑
                    </button>
                  </form>
                  <form action={moveProduct}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={i === products.length - 1}
                      aria-label={`Bajar ${product.name}`}
                    >
                      ↓
                    </button>
                  </form>
                </span>
                <form action={deleteProduct}>
                  <input type="hidden" name="productId" value={product.id} />
                  <button type="submit" className="danger">
                    Borrar
                  </button>
                </form>
              </div>

              {editing === product.id ? (
                <ProductForm product={product} save={saveProduct} onDone={() => setEditing(null)} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <ProductForm save={saveProduct} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          className="panel-btn panel-btn--ghost"
          disabled={products.length >= PRODUCTS_MAX}
          onClick={() => setAdding(true)}
        >
          Agregar producto
        </button>
      )}

      <p className="hint">
        {products.length}/{PRODUCTS_MAX} productos.
      </p>
    </div>
  );
}
