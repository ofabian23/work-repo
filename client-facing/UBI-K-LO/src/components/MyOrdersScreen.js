import React, { useMemo, useState } from 'react';
import {
  MagnifyingGlassIcon,
  ClockIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  CubeTransparentIcon,
  HomeIcon,
  ClipboardDocumentListIcon,
  WalletIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

const STATUS_STYLES = {
  PROGRESS: {
    label: 'PROGRESS',
    bg: 'bg-linde-information/10',
    text: 'text-linde-information',
    pill: 'bg-linde-information text-white',
  },
  FINISHED: {
    label: 'FINISHED',
    bg: 'bg-linde-success/10',
    text: 'text-linde-success',
    pill: 'bg-linde-success text-white',
  },
  FAILED: {
    label: 'FAILED',
    bg: 'bg-linde-error/10',
    text: 'text-linde-error',
    pill: 'bg-linde-error text-white',
  },
};

const FilterTab = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
      active
        ? 'bg-linde-blue text-white shadow-sm'
        : 'bg-white text-linde-blue border border-linde-blue'
    }`}
  >
    {label}
  </button>
);

function OrderCard({ order }) {
  const status = STATUS_STYLES[order.status];
  return (
    <div className="flex gap-4 p-3 rounded-xl bg-white shadow-sm border border-linde-light-gray/60 hover:shadow-md transition">
      <div className="relative w-16 h-16 flex items-center justify-center rounded-lg bg-linde-secondary/10 text-linde-blue">
        <CubeTransparentIcon className="h-8 w-8" />
        <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full ${status.pill}`}>
          {status.label}
        </span>
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-linde-dark-gray leading-tight">
            {order.title}
          </h3>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-linde-medium-gray">
          <div className="flex items-center gap-1"><ClockIcon className="h-4 w-4" />{order.duration}</div>
          <div className="flex items-center gap-1"><CurrencyDollarIcon className="h-4 w-4" />{order.total}</div>
          <div className="flex items-center gap-1"><CalendarDaysIcon className="h-4 w-4" />{order.date}</div>
        </div>
      </div>
    </div>
  );
}

export default function MyOrdersScreen({ user, onSignOut }) {
  const [activeFilter, setActiveFilter] = useState('ALL');

  const orders = useMemo(
    () => [
      {
        id: '1',
        title: 'UBI-K-LO Cylinder Delivery',
        duration: '10 hours',
        total: '$49,509',
        date: '12 January 2024',
        status: 'PROGRESS',
      },
      {
        id: '2',
        title: 'Argon Cylinder Refill',
        duration: '6 hours',
        total: '$12,140',
        date: '10 January 2024',
        status: 'PROGRESS',
      },
      {
        id: '3',
        title: 'Oxygen Cylinder Delivery',
        duration: '8 hours',
        total: '$21,380',
        date: '09 January 2024',
        status: 'FINISHED',
      },
      {
        id: '4',
        title: 'Nitrogen Cylinder Return',
        duration: '12 hours',
        total: '$2,640',
        date: '08 January 2024',
        status: 'FAILED',
      },
    ],
    []
  );

  const visibleOrders = useMemo(() => {
    if (activeFilter === 'ALL') return orders;
    return orders.filter((o) => o.status === activeFilter);
  }, [orders, activeFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-linde-50 to-linde-100">
      {/* App Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-linde-light-gray/60">
        <div className="mx-auto max-w-md px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-linde-dark-gray">My Orders</h1>
            <p className="text-xs text-linde-medium-gray">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-linde-light-gray text-linde-blue hover:bg-linde-secondary/10">
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="p-2 rounded-lg border border-linde-light-gray text-linde-error hover:bg-linde-error/10"
                title="Sign out"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-md px-4 pb-24">
        {/* Filters */}
        <div className="mt-4 flex items-center gap-3">
          <FilterTab label="All" active={activeFilter === 'ALL'} onClick={() => setActiveFilter('ALL')} />
          <FilterTab label="Progress" active={activeFilter === 'PROGRESS'} onClick={() => setActiveFilter('PROGRESS')} />
          <FilterTab label="Finished" active={activeFilter === 'FINISHED'} onClick={() => setActiveFilter('FINISHED')} />
        </div>

        {/* List */}
        <div className="mt-4 space-y-3">
          {visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-4 left-0 right-0">
        <div className="mx-auto max-w-md px-4">
          <div className="grid grid-cols-4 gap-3 bg-white border border-linde-light-gray/60 rounded-2xl p-2 shadow-lg">
            <button className="flex flex-col items-center gap-1 py-2 text-xs text-linde-medium-gray hover:text-linde-blue">
              <HomeIcon className="h-5 w-5" />
              <span>Discover</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-2 text-xs bg-linde-primary text-white rounded-xl">
              <ClipboardDocumentListIcon className="h-5 w-5" />
              <span>Orders</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-2 text-xs text-linde-medium-gray hover:text-linde-blue">
              <WalletIcon className="h-5 w-5" />
              <span>Wallet</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-2 text-xs text-linde-medium-gray hover:text-linde-blue">
              <Cog6ToothIcon className="h-5 w-5" />
              <span>Setting</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}


