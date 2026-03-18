import Head from 'expo-router/head';
import React, { Suspense } from 'react';
import { Text } from 'react-native';

type CacheEntry = {
  status: 'pending' | 'resolved';
  promise?: Promise<void>;
};

const cache = new Map<string, CacheEntry>();

function waitForShellMissedHeadTag(key: string) {
  let entry = cache.get(key);
  if (!entry) {
    let resolvePromise!: () => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    entry = { status: 'pending', promise };
    cache.set(key, entry);
    setTimeout(() => {
      entry!.status = 'resolved';
      resolvePromise();
    }, 50);
    throw promise;
  }

  if (entry.status === 'pending') {
    throw entry.promise;
  }

  cache.delete(key);
}

function LateHeadMetadata() {
  waitForShellMissedHeadTag('late-head-metadata');

  return (
    <Head>
      <meta name="expo-e2e-late-head" content="late" />
    </Head>
  );
}

export default function LateHeadPage() {
  return (
    <>
      <Head>
        <meta name="expo-e2e-shell-head" content="shell" />
      </Head>
      <Suspense fallback={null}>
        <LateHeadMetadata />
      </Suspense>
      <Text testID="late-head-text">Late Head</Text>
    </>
  );
}
