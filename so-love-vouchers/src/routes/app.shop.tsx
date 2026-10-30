import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, Loader2, Shirt, MessageCircle, Minus, Plus } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { toast } from "sonner";

export const Route = createFileRoute("/app/shop")({
  component: ShopPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  image_url: string | null;
  images: string[];
  colors: string[];
  sizes: string[];
};

const CATEGORY_LABEL: Record<string, string> = {
  golfer: "Golfer shirt",
  cap: "Cap",
  hoodie: "Hoodie",
  other: "Merch",
};

const COLOR_HEX: Record<string, string> = {
  black: "#1a1a1a",
  white: "#ffffff",
  red: "#cc2229",
  navy: "#1e2a44",
  blue: "#2563eb",
  grey: "#9ca3af",
  gray: "#9ca3af",
  charcoal: "#374151",
  green: "#16a34a",
  olive: "#5c6b3c",
  beige: "#d6c7a1",
  cream: "#f3ead7",
  pink: "#ec4899",
  maroon: "#7f1d1d",
  yellow: "#eab308",
  orange: "#ea580c",
  brown: "#7c4a21",
  purple: "#7c3aed",
};

const colorDot = (name: string) => COLOR_HEX[name.trim().toLowerCase()] ?? "#e5e5e5";

const formatPrice = (p: number) =>
  `R ${Number(p).toLocaleString("en-ZA", {
    minimumFractionDigits: p % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

// images[i] pairs with colors[i]; empty slots fall back to the cover.
const productImages = (p: Product) =>
  p.images?.length ? p.images : p.image_url ? [p.image_url] : [];

const coverImage = (p: Product) => productImages(p).find((u) => !!u) ?? p.image_url ?? null;

const galleryImages = (p: Product) => {
  const seen = new Set<string>();
  return productImages(p)
    .map((url, idx) => ({ url, idx }))
    .filter(({ url }) => !!url && !seen.has(url) && (seen.add(url), true));
};

function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? "27" + digits.slice(1) : digits;
}

function ShopPage() {
  useRealtimeInvalidate("shop_products", [["shop-products"]]);

  const [selected, setSelected] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["shop-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_products")
        .select("id, name, description, category, price, image_url, images, colors, sizes")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: contact } = useQuery({
    queryKey: ["contact-info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_info")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        general_email: string | null;
        contacts: { name: string; phone: string; image_url?: string | null }[];
      } | null;
    },
  });

  const visible = useMemo(() => products ?? [], [products]);

  return (
    <div className="space-y-7">
      <header className="border-b border-border pb-6">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold">
          Wear the love
        </p>
        <h1 className="text-3xl md:text-5xl font-bold mt-2 tracking-tight">SLK Shop</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Official So Love Krugersdorp merch, made for members.
        </p>
      </header>

      {isLoading ? (
        <div className="py-14 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center border-dashed bg-muted/30">
          <div className="size-12 mx-auto rounded-full bg-primary/10 text-primary grid place-items-center mb-3">
            <ShoppingBag className="size-6" />
          </div>
          <p className="font-semibold">Nothing here yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            New merch is on its way - check back soon.
          </p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3">
          {visible.map((p, i) => (
            <li
              key={p.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <ProductCard product={p} onOpen={() => setSelected(p)} />
            </li>
          ))}
        </ul>
      )}

      <ProductDialog product={selected} onClose={() => setSelected(null)} contact={contact} />
    </div>
  );
}

function ProductCard({ product: p, onOpen }: { product: Product; onOpen: () => void }) {
  const imgs = productImages(p);
  const gallery = galleryImages(p);
  // Clicking a colour dot on the card previews that colour's photo in place.
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const shown = (previewIdx !== null && imgs[previewIdx]) || coverImage(p);

  function previewColor(e: React.MouseEvent, colorIdx: number) {
    e.stopPropagation();
    if (imgs[colorIdx]) setPreviewIdx(colorIdx);
  }

  const shownPos = gallery.findIndex(({ url }) => url === shown);

  return (
    <button onClick={onOpen} className="block w-full text-left group h-full">
      <Card className="overflow-hidden rounded-2xl border-border/60 shadow-lg shadow-black/[0.04] ring-1 ring-black/[0.02] hover:shadow-xl hover:shadow-black/[0.08] hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 ease-out h-full flex flex-col p-0">
        {/* Image stage */}
        <div className="relative aspect-square bg-white border-b border-border/50">
          {shown ? (
            <img
              key={shown}
              src={shown}
              alt={p.name}
              loading="lazy"
              className="absolute inset-0 size-full object-contain p-4 group-hover:scale-[1.05] transition-transform duration-500 animate-rise"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground/30">
              <Shirt className="size-12" />
            </div>
          )}
          {gallery.length > 1 && (
            <span className="absolute bottom-2 right-2 font-serial text-[9px] bg-foreground/80 text-background rounded-full px-2 py-0.5">
              {Math.max(shownPos, 0) + 1}/{gallery.length}
            </span>
          )}
        </div>
        {/* Label area */}
        <div className="p-4 flex flex-col gap-1 flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
            {CATEGORY_LABEL[p.category] ?? p.category}
          </p>
          <p className="font-semibold leading-snug line-clamp-2">{p.name}</p>
          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <p className="font-serial text-base font-bold">{formatPrice(p.price)}</p>
            {p.colors.length > 0 && (
              <div className="flex items-center gap-1.5">
                {p.colors.slice(0, 4).map((c, idx) => (
                  <span
                    key={c}
                    role="button"
                    tabIndex={0}
                    title={imgs[idx] ? `View in ${c}` : c}
                    aria-label={imgs[idx] ? `View in ${c}` : c}
                    onClick={(e) => previewColor(e, idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (imgs[idx]) setPreviewIdx(idx);
                      }
                    }}
                    className={`size-4 rounded-full border transition-all ${
                      previewIdx === idx
                        ? "border-primary ring-2 ring-primary/30 scale-110"
                        : "border-black/10"
                    } ${imgs[idx] ? "cursor-pointer hover:scale-125" : ""}`}
                    style={{ backgroundColor: colorDot(c) }}
                  />
                ))}
                {p.colors.length > 4 && (
                  <span className="text-[9px] text-muted-foreground">+{p.colors.length - 4}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </button>
  );
}

function ProductDialog({
  product,
  onClose,
  contact,
}: {
  product: Product | null;
  onClose: () => void;
  contact:
    | {
        general_email: string | null;
        contacts: { name: string; phone: string; image_url?: string | null }[];
      }
    | null
    | undefined;
}) {
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        key={product?.id ?? "none"}
        className="max-w-md sm:max-w-3xl p-0 gap-0 overflow-hidden max-h-[94vh] flex flex-col"
      >
        {product && <ProductDetail product={product} contact={contact} />}
      </DialogContent>
    </Dialog>
  );
}

function ProductDetail({
  product,
  contact,
}: {
  product: Product;
  contact:
    | {
        general_email: string | null;
        contacts: { name: string; phone: string; image_url?: string | null }[];
      }
    | null
    | undefined;
}) {
  const imgs = productImages(product);
  const gallery = galleryImages(product);
  const firstIdx = gallery[0]?.idx ?? 0;
  const [imgIdx, setImgIdx] = useState(firstIdx);
  const [color, setColor] = useState<string | null>(
    product.colors.length === 1 ? product.colors[0] : null,
  );

  // Each colour pairs with its photo slot (colors[i] ↔ images[i]): picking a
  // colour switches the picture to that colour's photo when one was uploaded.
  function pickColor(c: string) {
    setColor(c);
    const i = product.colors.indexOf(c);
    if (i >= 0 && imgs[i]) setImgIdx(i);
  }

  const shownImage = imgs[imgIdx] || coverImage(product);
  const [size, setSize] = useState<string | null>(
    product.sizes.length === 1 ? product.sizes[0] : null,
  );
  const [qty, setQty] = useState(1);

  function order() {
    if (product.colors.length > 0 && !color) {
      toast.error("Pick a colour first");
      return;
    }
    if (product.sizes.length > 0 && !size) {
      toast.error("Pick a size first");
      return;
    }
    const msg = encodeURIComponent(
      `Hi! I'd like to order from the SLK Shop:\n\n` +
        `Item: ${product.name}\n` +
        (color ? `Colour: ${color}\n` : "") +
        (size ? `Size: ${size}\n` : "") +
        `Quantity: ${qty}\n` +
        `Price: ${formatPrice(product.price)} each\n` +
        `Total: ${formatPrice(product.price * qty)}\n\nThank you!`,
    );
    const phone = contact?.contacts?.[0]?.phone;
    if (phone) {
      window.open(`https://wa.me/${waNumber(phone)}?text=${msg}`, "_blank");
    } else if (contact?.general_email) {
      window.location.href = `mailto:${contact.general_email}?subject=${encodeURIComponent(
        `SLK Shop order: ${product.name}`,
      )}&body=${msg}`;
    } else {
      toast.error("Ordering is temporarily unavailable - please contact the SLK team.");
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 flex-1 overflow-y-auto">
      {/* Gallery */}
      <div className="bg-white border-b sm:border-b-0 sm:border-r border-border/60 p-4 flex flex-col gap-3">
        <div className="relative aspect-square">
          {shownImage ? (
            <img
              key={shownImage}
              src={shownImage}
              alt={product.name}
              className="absolute inset-0 size-full object-contain animate-rise"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground/30">
              <Shirt className="size-16" />
            </div>
          )}
        </div>
        {gallery.length > 1 && (
          <div className="flex gap-2 justify-center flex-wrap">
            {gallery.map(({ url, idx }) => (
              <button
                key={idx}
                onClick={() => {
                  setImgIdx(idx);
                  // Keep the colour picker in sync with the photo being viewed.
                  if (product.colors[idx]) setColor(product.colors[idx]);
                }}
                className={`size-14 rounded-lg border-2 overflow-hidden bg-white transition-all ${
                  shownImage === url
                    ? "border-primary shadow-md"
                    : "border-border hover:border-foreground/30"
                }`}
                aria-label={
                  product.colors[idx] ? `${product.colors[idx]} photo` : `Photo ${idx + 1}`
                }
                title={product.colors[idx] ?? undefined}
              >
                <img src={url} alt="" className="size-full object-contain p-1" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-6 flex flex-col">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
          {CATEGORY_LABEL[product.category] ?? product.category}
        </p>
        <DialogTitle
          className="text-2xl leading-tight mt-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {product.name}
        </DialogTitle>
        <p className="font-serial text-2xl font-bold mt-2">{formatPrice(product.price)}</p>
        {product.description && (
          <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line leading-relaxed">
            {product.description}
          </p>
        )}

        <div
          className="ticket-tear my-5"
          style={{ "--tear-inset": "1.5rem" } as Record<string, string>}
          aria-hidden="true"
        />

        {product.colors.length > 0 && (
          <div className="mb-5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Colour
              </p>
              <p className="text-xs font-medium">{color ?? "Select"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => (
                <button
                  key={c}
                  onClick={() => pickColor(c)}
                  title={c}
                  aria-label={c}
                  className={`size-9 rounded-full border-2 transition-all grid place-items-center ${
                    color === c
                      ? "border-primary scale-110 shadow-md"
                      : "border-black/10 hover:scale-105"
                  }`}
                  style={{ backgroundColor: colorDot(c) }}
                >
                  {color === c && (
                    <span className="size-2 rounded-full bg-white mix-blend-difference" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.sizes.length > 0 && (
          <div className="mb-5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Size
              </p>
              <p className="text-xs font-medium">{size ?? "Select"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`min-w-11 rounded-lg border px-3 py-2 text-sm font-serial font-semibold transition-colors ${
                    size === s
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card border-border hover:border-foreground/40"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="mb-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Quantity
          </p>
          <div className="inline-flex items-center rounded-full border border-border">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="size-10 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={qty <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center font-serial font-bold">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(10, q + 1))}
              className="size-10 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={qty >= 10}
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <Button size="lg" className="w-full font-semibold gap-2 h-12" onClick={order}>
            <MessageCircle className="size-4" />
            Order on WhatsApp · {formatPrice(product.price * qty)}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Your order goes straight to the SLK team - they'll confirm payment and collection.
          </p>
        </div>
      </div>
    </div>
  );
}
