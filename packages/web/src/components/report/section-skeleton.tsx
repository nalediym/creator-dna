export function SectionSkeleton() {
  return (
    <div className="py-16">
      <div className="h-3 w-24 bg-surface-raised rounded animate-pulse mb-6" />
      <div className="h-6 w-3/5 bg-surface-raised rounded animate-pulse mb-4" />
      <div className="space-y-3">
        <div className="h-28 bg-surface-raised rounded-xl animate-pulse" />
        <div className="h-28 bg-surface-raised rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
