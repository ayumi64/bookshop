import Link from 'next/link';
import Image from 'next/image';
import type { BookWithPurchase } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, BookOpenText } from 'lucide-react';

export function BookCard({ book }: { book: BookWithPurchase }) {
  const statusBadge =
    book.purchased ? (
      <Badge variant="success" className="gap-1">
        <Check className="h-3 w-3" aria-hidden="true" /> 已购
      </Badge>
    ) : book.price_cents === 0 ? (
      <Badge variant="secondary">免费</Badge>
    ) : (
      <Badge variant="outline">试读</Badge>
    );

  return (
    <Link
      href={`/books/${book.slug}`}
      className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      aria-label={`${book.title} - ${book.purchased ? '已购，开始阅读' : '价格 ' + formatPrice(book.price_cents, book.currency)}`}
    >
      <Card className="overflow-hidden transition-shadow hover:shadow-md h-full">
        <div className="relative aspect-[3/4] w-full bg-muted">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={`${book.title} 封面`}
              fill
              sizes="(min-width:780px) 33vw, (min-width:480px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              <BookOpenText className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-snug line-clamp-1">{book.title}</h3>
            {statusBadge}
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
            {book.author || '佚名'}
            {book.category ? ` · ${book.category}` : ''}
          </p>
          <p className="mt-2 text-sm font-medium">
            {book.purchased ? <span className="text-success">开始阅读 →</span> : formatPrice(book.price_cents, book.currency)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
