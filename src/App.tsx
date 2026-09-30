/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  Utensils,
  RefreshCw,
  Check,
  Bookmark,
  Copy,
  ArrowRight,
  Heart,
} from 'lucide-react';
import {
  LUNCH_MENUS,
  MOOD_OPTIONS,
  LunchMenu,
  CuisineType,
  DiningType,
  MoodType,
} from './data/menus';

type CuisineFilter = CuisineType | '전체';
type SpicyOption = '가능' | '매운맛선호' | '불가능';
type ActiveSection = 'recommend' | 'catalog' | 'saved';

interface ScoredMenu {
  menu: LunchMenu;
  score: number;
  oneLineReason: string;
  detailedReason: string;
  budgetNote: string;
  isExactBudgetMatch: boolean;
}

const CUISINE_OPTIONS: { value: CuisineFilter; label: string; desc: string }[] = [
  { value: '한식', label: '한식', desc: '찌개 · 백반 · 구이' },
  { value: '중식', label: '중식', desc: '짜장 · 짬뽕 · 마라' },
  { value: '일식', label: '일식', desc: '돈카츠 · 초밥 · 소바' },
  { value: '양식', label: '양식', desc: '파스타 · 샐러드 · 버거' },
  { value: '전체', label: '전체 종류', desc: '모두 포함' },
];

const BUDGET_PRESETS = [
  { value: 8000, label: '8,000원 이하', sub: '가성비 든든' },
  { value: 10000, label: '10,000원 이하', sub: '직장인 평균' },
  { value: 13000, label: '13,000원 이하', sub: '여유로운 한 끼' },
  { value: 17000, label: '17,000원 이하', sub: '기분 전환 특식' },
];

export default function App() {
  // Navigation state
  const [activeSection, setActiveSection] = useState<ActiveSection>('recommend');

  // 6 User Inputs (4 Existing + Mood + Diet)
  const [mood, setMood] = useState<MoodType>('happy');
  const [isDiet, setIsDiet] = useState<boolean>(false);
  const [cuisine, setCuisine] = useState<CuisineFilter>('한식');
  const [budget, setBudget] = useState<number>(11000);
  const [spicyOption, setSpicyOption] = useState<SpicyOption>('가능');
  const [diningType, setDiningType] = useState<DiningType>('혼밥');

  // Recommendation state
  const [rotationOffset, setRotationOffset] = useState<number>(0);
  const [hasRequested, setHasRequested] = useState<boolean>(true);
  const [savedIds, setSavedIds] = useState<string[]>(['kr-2', 'jp-3']);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [catalogCategory, setCatalogCategory] = useState<CuisineFilter>('전체');

  const resultsRef = useRef<HTMLDivElement>(null);

  const selectedMoodLabel = useMemo(
    () => MOOD_OPTIONS.find((m) => m.value === mood)?.label ?? '😊 행복해요',
    [mood]
  );

  // Build personalized one-line explanation and score each menu
  const rankedMenus = useMemo<ScoredMenu[]>(() => {
    const moodShortText: Record<MoodType, string> = {
      happy: '행복한 기분을 더 살려줄',
      tired: '피곤한 몸에 활력을 채워줄',
      stressed: '쌓인 스트레스를 시원하게 날려줄',
      hearty: '오후까지 든든하게 배를 채워줄',
    };

    const scored = LUNCH_MENUS.map((menu) => {
      let score = 0;

      // 1. Cuisine Match
      const cuisineMatch = cuisine === '전체' || menu.category === cuisine;
      if (cuisineMatch) {
        score += 120;
      }

      // 2. Diet Match
      if (isDiet) {
        if (menu.isDietFriendly) {
          score += 90;
        } else {
          score -= 40;
        }
      } else {
        score += 20;
      }

      // 3. Mood Match
      const moodMatchIndex = menu.bestMoods.indexOf(mood);
      if (moodMatchIndex !== -1) {
        // Higher bonus for primary mood match
        score += 75 - moodMatchIndex * 10;
      }

      // 4. Spicy Match
      let spicyMatch = true;
      if (spicyOption === '불가능' && menu.isSpicy) {
        spicyMatch = false;
      } else if (spicyOption === '매운맛선호' && !menu.isSpicy) {
        spicyMatch = false;
      }
      if (spicyMatch) {
        score += 65;
      } else if (spicyOption === '가능') {
        score += 45;
      }

      // 5. Budget Match
      const isWithinBudget = menu.estimatedPrice <= budget;
      const priceDiff = budget - menu.estimatedPrice;
      if (isWithinBudget) {
        score += 55;
        const proximityBonus = Math.max(
          0,
          15 - Math.floor(Math.abs(priceDiff) / 1000)
        );
        score += proximityBonus;
      } else {
        const overAmount = menu.estimatedPrice - budget;
        score -= Math.min(50, Math.ceil(overAmount / 500) * 6);
      }

      // 6. Dining Type Match (혼밥 vs 함께 식사)
      const diningMatch = menu.suitableFor.includes(diningType);
      if (diningMatch) {
        score += 40;
      }

      // Build crisp ONE-LINE recommendation explanation ("왜 이 메뉴를 추천했는지 한 줄로 설명")
      const dietPhrase = isDiet
        ? menu.isDietFriendly
          ? `약 ${menu.calories}kcal의 가벼운 다이어트 식단으로, `
          : `단백질 위주로 건져 먹기 좋으며, `
        : '';

      const spicyPhrase = menu.isSpicy ? '매콤한 ' : '속 편하고 담백한 ';
      const diningPhrase =
        diningType === '혼밥'
          ? '혼자서도 부담 없이 즐기기 좋아 추천해요.'
          : '동료·친구와 함께 맛있게 나누기 좋아 추천해요.';

      const oneLineReason = `${dietPhrase}${moodShortText[mood]} ${spicyPhrase}${menu.category} 메뉴로, ${ budget.toLocaleString() }원 예산 안에서 ${diningPhrase}`;

      // Detailed supporting explanation
      const moodReason = menu.moodReasonMap[mood];
      const diningReason =
        diningType === '혼밥' ? menu.reasonSolo : menu.reasonGroup;

      let budgetNote = '';
      if (isWithinBudget) {
        if (priceDiff >= 2000) {
          budgetNote = `예산(${budget.toLocaleString()}원)보다 약 ${priceDiff.toLocaleString()}원 여유가 있어요.`;
        } else {
          budgetNote = `설정한 예산(${budget.toLocaleString()}원)에 딱 맞춘 구성입니다.`;
        }
      } else {
        const diff = menu.estimatedPrice - budget;
        budgetNote = `예산보다 약 ${diff.toLocaleString()}원 높지만 기분·식단 조건에 잘 맞아 함께 추천해 드려요.`;
      }

      const detailedReason = `${moodReason} ${diningReason}`;

      return {
        menu,
        score,
        oneLineReason,
        detailedReason,
        budgetNote,
        isExactBudgetMatch: isWithinBudget,
      };
    });

    // Strict filtering on cuisine and non-spicy when requested, with graceful fallback if < 3
    const strictPool = scored.filter((item) => {
      if (cuisine !== '전체' && item.menu.category !== cuisine) {
        return false;
      }
      if (spicyOption === '불가능' && item.menu.isSpicy) {
        return false;
      }
      if (isDiet && !item.menu.isDietFriendly) {
        return false;
      }
      return true;
    });

    const relaxedDietPool = scored.filter((item) => {
      if (cuisine !== '전체' && item.menu.category !== cuisine) {
        return false;
      }
      if (spicyOption === '불가능' && item.menu.isSpicy) {
        return false;
      }
      return true;
    });

    const pool =
      strictPool.length >= 3
        ? strictPool
        : relaxedDietPool.length >= 3
        ? relaxedDietPool
        : scored;

    return [...pool].sort((a, b) => b.score - a.score);
  }, [cuisine, budget, spicyOption, diningType, mood, isDiet]);

  // Select 3 menus using rotationOffset so user can also click "다른 메뉴 조합 보기"
  const recommendedThree = useMemo<ScoredMenu[]>(() => {
    if (rankedMenus.length <= 3) return rankedMenus;
    const poolSize = Math.min(rankedMenus.length, 6);
    const topPool = rankedMenus.slice(0, poolSize);
    const result: ScoredMenu[] = [];
    for (let i = 0; i < 3; i++) {
      result.push(topPool[(rotationOffset + i) % topPool.length]);
    }
    return result;
  }, [rankedMenus, rotationOffset]);

  const handleRecommendClick = () => {
    setHasRequested(true);
    setRotationOffset(0);
    setActiveSection('recommend');
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleShuffleThree = () => {
    setRotationOffset((prev) => prev + 1);
  };

  const handleResetFilters = () => {
    setMood('happy');
    setIsDiet(false);
    setCuisine('한식');
    setBudget(11000);
    setSpicyOption('가능');
    setDiningType('혼밥');
    setRotationOffset(0);
    setActiveSection('recommend');
  };

  const toggleSaved = (id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyMenu = (menuName: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(menuName).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  const savedMenus = useMemo(
    () => LUNCH_MENUS.filter((m) => savedIds.includes(m.id)),
    [savedIds]
  );

  const filteredCatalog = useMemo(() => {
    if (catalogCategory === '전체') return LUNCH_MENUS;
    return LUNCH_MENUS.filter((m) => m.category === catalogCategory);
  }, [catalogCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900">
      {/* Top Bar Contract: Zone 1 (Single brand wordmark) — Zone 2 (Clean nav links) — Zone 3 (Primary action) */}
      <header className="sticky top-0 z-30 h-14 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-8 flex items-center justify-between">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('recommend');
          }}
          className="font-display text-xl font-semibold tracking-tight text-stone-900 whitespace-nowrap"
        >
          오늘점심
        </a>

        <nav className="flex items-center gap-4 sm:gap-7 text-sm font-medium text-stone-600">
          <button
            type="button"
            onClick={() => setActiveSection('recommend')}
            className={`min-h-[44px] px-1 transition-colors whitespace-nowrap border-b-2 ${
              activeSection === 'recommend'
                ? 'border-orange-600 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            맞춤 추천
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('catalog')}
            className={`min-h-[44px] px-1 transition-colors whitespace-nowrap border-b-2 ${
              activeSection === 'catalog'
                ? 'border-orange-600 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            전체 메뉴판
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('saved')}
            className={`min-h-[44px] px-1 transition-colors whitespace-nowrap border-b-2 ${
              activeSection === 'saved'
                ? 'border-orange-600 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            찜한 메뉴 ({savedIds.length})
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetFilters}
            className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-200/70 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap"
          >
            조건 초기화
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        {activeSection === 'recommend' && (
          <>
            {/* Friendly Hero Introduction */}
            <section className="mb-7 sm:mb-9">
              <p className="text-xs font-semibold text-orange-700 mb-2">
                기분과 식단까지 챙기는 10초 점심 가이드
              </p>
              <h1 className="font-display text-2xl sm:text-4xl font-semibold text-stone-900 tracking-tight leading-snug">
                오늘 기분과 상황에 딱 맞는 점심은 무엇일까요?
              </h1>
              <p className="mt-2 text-sm sm:text-base text-stone-600 max-w-2xl leading-relaxed">
                오늘의 기분과 다이어트 여부, 음식 종류, 예산, 맵기, 식사 인원을 차례대로 눌러보세요.
                초보자도 고민 없이 고를 수 있도록 맞춤 메뉴 3가지를 한 줄 이유와 함께 추천해 드립니다.
              </p>
            </section>

            {/* Two-Column Responsive Layout on Desktop, Ergonomic Stacked Flow on Smartphone */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Intuitive Beginner-Friendly Condition Selector Panel */}
              <section
                aria-label="점심 메뉴 추천 조건 선택"
                className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-7"
              >
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-stone-100">
                  <div>
                    <h2 className="font-display text-lg sm:text-xl font-semibold text-stone-900">
                      점심 추천 조건 고르기
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      원하는 버튼을 가볍게 터치해 선택해 주세요
                    </p>
                  </div>
                  <span className="text-xs text-stone-400 tabular-nums">
                    6단계 맞춤
                  </span>
                </div>

                <div className="space-y-6">
                  {/* Step 1: 오늘의 기분 */}
                  <div>
                    <label className="block text-sm font-semibold text-stone-900 mb-1">
                      01. 오늘의 기분은 어떠신가요?
                    </label>
                    <p className="text-xs text-stone-500 mb-2.5">
                      지금 기분에 어울리는 맛과 식감의 메뉴를 우선 추천해 드려요.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {MOOD_OPTIONS.map((item) => {
                        const active = mood === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              setMood(item.value);
                              setRotationOffset(0);
                            }}
                            className={`min-h-[52px] px-3.5 py-2.5 rounded-xl text-left transition-all flex flex-col justify-center ${
                              active
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'bg-stone-100/80 text-stone-800 hover:bg-stone-200/70'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                              {item.label}
                            </span>
                            <span
                              className={`text-[11px] truncate mt-0.5 ${
                                active ? 'text-orange-100' : 'text-stone-500'
                              }`}
                            >
                              {item.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: 다이어트 여부 */}
                  <div className="pt-5 border-t border-stone-100">
                    <label className="block text-sm font-semibold text-stone-900 mb-1">
                      02. 현재 다이어트 중이신가요?
                    </label>
                    <p className="text-xs text-stone-500 mb-2.5">
                      다이어트 중을 선택하면 저칼로리·고단백 메뉴를 우선 골라드려요.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDiet(false);
                          setRotationOffset(0);
                        }}
                        className={`min-h-[50px] px-3.5 py-2.5 rounded-xl text-left transition-all ${
                          !isDiet
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-stone-100/80 text-stone-800 hover:bg-stone-200/70'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                          일반 식사 (상관없음)
                        </div>
                        <div
                          className={`text-[11px] truncate ${
                            !isDiet ? 'text-orange-100' : 'text-stone-500'
                          }`}
                        >
                          칼로리 제한 없이 맛있게
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsDiet(true);
                          setRotationOffset(0);
                        }}
                        className={`min-h-[50px] px-3.5 py-2.5 rounded-xl text-left transition-all ${
                          isDiet
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-stone-100/80 text-stone-800 hover:bg-stone-200/70'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                          다이어트 중 (식단 관리)
                        </div>
                        <div
                          className={`text-[11px] truncate ${
                            isDiet ? 'text-orange-100' : 'text-stone-500'
                          }`}
                        >
                          가볍고 건강한 고단백 메뉴
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Step 3: 음식 종류 */}
                  <div className="pt-5 border-t border-stone-100">
                    <label className="block text-sm font-semibold text-stone-900 mb-1">
                      03. 어떤 종류의 음식이 당기시나요?
                    </label>
                    <p className="text-xs text-stone-500 mb-2.5">
                      한식, 중식, 일식, 양식 중 원하는 종류를 선택해 주세요.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CUISINE_OPTIONS.map((item) => {
                        const isSelected = cuisine === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              setCuisine(item.value);
                              setRotationOffset(0);
                            }}
                            className={`min-h-[50px] px-3 py-2 rounded-xl text-left transition-all flex flex-col justify-center ${
                              item.value === '전체' ? 'col-span-2 sm:col-span-1' : ''
                            } ${
                              isSelected
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'bg-stone-100/80 text-stone-800 hover:bg-stone-200/70'
                            }`}
                          >
                            <span className="text-sm font-semibold whitespace-nowrap">
                              {item.label}
                            </span>
                            <span
                              className={`text-[11px] truncate ${
                                isSelected ? 'text-orange-100' : 'text-stone-500'
                              }`}
                            >
                              {item.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 4: 1인당 예산 */}
                  <div className="pt-5 border-t border-stone-100">
                    <div className="flex items-baseline justify-between mb-1">
                      <label
                        htmlFor="budget-slider"
                        className="text-sm font-semibold text-stone-900"
                      >
                        04. 1인당 예산은 얼마인가요?
                      </label>
                      <span className="font-mono text-base font-semibold text-orange-600 tabular-nums">
                        {budget.toLocaleString()}원 이하
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mb-2.5">
                      버튼으로 바로 고르거나 슬라이더를 좌우로 움직여 조절해 보세요.
                    </p>

                    {/* Quick Preset Buttons */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {BUDGET_PRESETS.map((preset) => {
                        const active = budget === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => {
                              setBudget(preset.value);
                              setRotationOffset(0);
                            }}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-left transition-colors flex items-center justify-between ${
                              active
                                ? 'bg-stone-900 text-white'
                                : 'bg-stone-100/80 text-stone-700 hover:bg-stone-200/70'
                            }`}
                          >
                            <span className="text-xs font-semibold whitespace-nowrap tabular-nums">
                              {preset.label}
                            </span>
                            <span
                              className={`text-[11px] whitespace-nowrap ${
                                active ? 'text-stone-300' : 'text-stone-500'
                              }`}
                            >
                              {preset.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Fine-grained Range Slider */}
                    <div className="px-1">
                      <input
                        id="budget-slider"
                        type="range"
                        min={7000}
                        max={20000}
                        step={500}
                        value={budget}
                        onChange={(e) => {
                          setBudget(Number(e.target.value));
                          setRotationOffset(0);
                        }}
                        className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                      />
                      <div className="flex justify-between text-[11px] text-stone-400 font-mono tabular-nums mt-1">
                        <span>7,000원</span>
                        <span>11,000원</span>
                        <span>15,000원</span>
                        <span>20,000원</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 5: 매운 음식 가능 여부 */}
                  <div className="pt-5 border-t border-stone-100">
                    <label className="block text-sm font-semibold text-stone-900 mb-1">
                      05. 매운 음식 가능 여부
                    </label>
                    <p className="text-xs text-stone-500 mb-2.5">
                      매운 음식을 못 드신다면 ‘불가능(순한맛만)’을 선택해 주세요.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSpicyOption('가능');
                          setRotationOffset(0);
                        }}
                        className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap flex items-center justify-center ${
                          spicyOption === '가능'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-stone-100/80 text-stone-700 hover:bg-stone-200/70'
                        }`}
                      >
                        매운 음식 가능
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSpicyOption('불가능');
                          setRotationOffset(0);
                        }}
                        className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap flex items-center justify-center ${
                          spicyOption === '불가능'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-stone-100/80 text-stone-700 hover:bg-stone-200/70'
                        }`}
                      >
                        불가능 (순한맛만)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSpicyOption('매운맛선호');
                          setRotationOffset(0);
                        }}
                        className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap flex items-center justify-center ${
                          spicyOption === '매운맛선호'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-stone-100/80 text-stone-700 hover:bg-stone-200/70'
                        }`}
                      >
                        매콤한 메뉴만
                      </button>
                    </div>
                  </div>

                  {/* Step 6: 혼밥 또는 함께 식사 */}
                  <div className="pt-5 border-t border-stone-100">
                    <label className="block text-sm font-semibold text-stone-900 mb-1">
                      06. 누구와 식사하시나요?
                    </label>
                    <p className="text-xs text-stone-500 mb-2.5">
                      식사 인원에 따라 방문하기 편안한 메뉴를 골라 드립니다.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDiningType('혼밥');
                          setRotationOffset(0);
                        }}
                        className={`min-h-[50px] px-3.5 py-2.5 rounded-xl text-left transition-all ${
                          diningType === '혼밥'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-stone-100/80 text-stone-800 hover:bg-stone-200/70'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                          혼밥 (1인 식사)
                        </div>
                        <div
                          className={`text-[11px] truncate ${
                            diningType === '혼밥'
                              ? 'text-orange-100'
                              : 'text-stone-500'
                          }`}
                        >
                          혼자서도 편안한 한 끼
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDiningType('함께 식사');
                          setRotationOffset(0);
                        }}
                        className={`min-h-[50px] px-3.5 py-2.5 rounded-xl text-left transition-all ${
                          diningType === '함께 식사'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-stone-100/80 text-stone-800 hover:bg-stone-200/70'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                          함께 식사 (2인 이상)
                        </div>
                        <div
                          className={`text-[11px] truncate ${
                            diningType === '함께 식사'
                              ? 'text-orange-100'
                              : 'text-stone-500'
                          }`}
                        >
                          동료·친구와 나눠 먹기 좋은
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Primary Action Button: [추천하기] */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleRecommendClick}
                      className="w-full min-h-[54px] px-6 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Utensils className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">추천하기</span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>
              </section>

              {/* Right Column: 3 Recommended Menu Results */}
              <section
                ref={resultsRef}
                aria-label="맞춤 추천 메뉴 3선"
                className="lg:col-span-7 space-y-5"
              >
                {/* Result Header Bar & Current Selection Summary */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-stone-200/80">
                  <div>
                    {/* Clean unboxed metadata summary with · separators */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 mb-1">
                      <span className="font-semibold text-orange-700">
                        선택 조건
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedMoodLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{isDiet ? '다이어트 식단' : '일반 식사'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{cuisine}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {budget.toLocaleString()}원 이하
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {spicyOption === '가능'
                          ? '매운맛 가능'
                          : spicyOption === '불가능'
                          ? '순한맛만'
                          : '매콤 선호'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{diningType}</span>
                    </div>
                    <h2 className="font-display text-xl sm:text-2xl font-semibold text-stone-900">
                      오늘의 맞춤 점심 메뉴 3선
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleShuffleThree}
                    className="self-start sm:self-auto min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-stone-200/90 hover:bg-stone-100 text-xs font-semibold text-stone-700 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-orange-600" />
                    <span>다른 메뉴 조합 보기</span>
                  </button>
                </div>

                {/* 3 Menu Cards List */}
                {hasRequested && (
                  <div className="space-y-4">
                    {recommendedThree.map((item, idx) => {
                      const {
                        menu,
                        oneLineReason,
                        detailedReason,
                        budgetNote,
                      } = item;
                      const isSaved = savedIds.includes(menu.id);
                      const isCopied = copiedId === menu.id;

                      return (
                        <article
                          key={menu.id}
                          className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 transition-transform"
                        >
                          {/* Top Row: Editorial Numbering + Unboxed Metadata */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                              <span className="font-mono font-semibold text-orange-600 tabular-nums">
                                0{idx + 1}. 추천 메뉴
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-stone-700">
                                {menu.category}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{menu.spicyLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                약 {menu.calories}kcal
                              </span>
                              {menu.isDietFriendly && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-emerald-700 font-medium">
                                    다이어트 적합
                                  </span>
                                </>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleSaved(menu.id)}
                              aria-label={isSaved ? '찜 취소' : '메뉴 찜하기'}
                              className={`min-h-[40px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap ${
                                isSaved
                                  ? 'text-orange-700 bg-orange-50'
                                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                              }`}
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${
                                  isSaved ? 'fill-orange-600 text-orange-600' : ''
                                }`}
                              />
                              <span>{isSaved ? '찜됨' : '찜하기'}</span>
                            </button>
                          </div>

                          {/* Menu Name & Estimated Price */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 mb-3">
                            <h3 className="font-display text-xl sm:text-2xl font-semibold text-stone-900">
                              {menu.name}
                            </h3>
                            <div className="flex items-baseline gap-2 shrink-0">
                              <span className="text-xs text-stone-500">예상 가격</span>
                              <span className="font-mono text-lg font-semibold text-stone-900 tabular-nums">
                                약 {menu.estimatedPrice.toLocaleString()}원
                              </span>
                              <span className="text-xs text-stone-400 tabular-nums">
                                ({menu.priceDisplay})
                              </span>
                            </div>
                          </div>

                          {/* Crisp One-Line Recommendation Summary ("왜 이 메뉴를 추천했는지 한 줄로 설명") */}
                          <div className="mb-3.5 pl-3 border-l-2 border-orange-500">
                            <p className="text-sm font-semibold text-stone-900 leading-snug">
                              <span className="text-orange-700 mr-1.5">한 줄 추천 이유 ·</span>
                              {oneLineReason}
                            </p>
                          </div>

                          {/* Menu Summary */}
                          <p className="text-sm text-stone-700 leading-relaxed mb-4">
                            {menu.summary}
                          </p>

                          {/* Hairline Divider & Detailed Context */}
                          <div className="border-t border-stone-100 pt-3.5 space-y-2 text-xs sm:text-sm">
                            <div>
                              <span className="font-semibold text-stone-800 mr-1.5">
                                기분·상황 맞춤 포인트 ·
                              </span>
                              <span className="text-stone-600 leading-relaxed">
                                {detailedReason} {budgetNote}
                              </span>
                            </div>

                            {isDiet && (
                              <div className="text-xs text-emerald-800">
                                <span className="font-semibold mr-1.5">
                                  다이어트 식단 팁 ·
                                </span>
                                <span>{menu.dietNote}</span>
                              </div>
                            )}

                            <div className="text-xs text-stone-500">
                              <span className="font-semibold text-stone-700 mr-1.5">
                                맛있게 먹는 팁 ·
                              </span>
                              <span>{menu.pairingTip}</span>
                            </div>
                          </div>

                          {/* Bottom Card Actions */}
                          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                            <span className="text-xs text-stone-500">
                              식사 형태: {menu.suitableFor.join(' · ')} 모두 적합
                            </span>

                            <button
                              type="button"
                              onClick={() => handleCopyMenu(menu.name, menu.id)}
                              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200/80 text-xs font-medium text-stone-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700 font-semibold">
                                    메뉴 이름 복사됨
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                                  <span>메뉴명 복사하기</span>
                                </>
                              )}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {/* Section 2: Full Menu Catalog View */}
        {activeSection === 'catalog' && (
          <section aria-label="전체 점심 메뉴판" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-5">
              <div>
                <p className="text-xs font-semibold text-orange-700 mb-1">
                  한눈에 보는 점심 가이드
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900">
                  전체 점심 메뉴판 ({filteredCatalog.length}선)
                </h1>
              </div>

              {/* Interactive Category Filter Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-stone-200/70 rounded-xl self-start">
                {(['전체', '한식', '중식', '일식', '양식'] as CuisineFilter[]).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatalogCategory(cat)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                        catalogCategory === cat
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCatalog.map((menu) => {
                const isSaved = savedIds.includes(menu.id);
                return (
                  <article
                    key={menu.id}
                    className="bg-white rounded-2xl border border-stone-200/90 p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-stone-500 mb-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-orange-700">
                            {menu.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{menu.isSpicy ? '매콤한 맛' : '순한 맛'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">약 {menu.calories}kcal</span>
                          {menu.isDietFriendly && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-700 font-medium">
                                다이어트 추천
                              </span>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSaved(menu.id)}
                          className="min-h-[36px] px-2 text-xs font-medium text-stone-500 hover:text-orange-600 flex items-center gap-1 shrink-0"
                        >
                          <Bookmark
                            className={`w-3.5 h-3.5 ${
                              isSaved ? 'fill-orange-600 text-orange-600' : ''
                            }`}
                          />
                          <span>{isSaved ? '찜됨' : '찜'}</span>
                        </button>
                      </div>

                      <div className="flex items-baseline justify-between gap-2 mb-2">
                        <h2 className="font-display text-lg font-semibold text-stone-900">
                          {menu.name}
                        </h2>
                        <span className="font-mono text-sm font-semibold text-stone-900 tabular-nums shrink-0">
                          약 {menu.estimatedPrice.toLocaleString()}원
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 leading-relaxed">
                        {menu.summary}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-500">
                      <span className="font-semibold text-stone-700 mr-1.5">
                        식단 팁 ·
                      </span>
                      <span>{menu.dietNote}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Section 3: Saved Menus View */}
        {activeSection === 'saved' && (
          <section aria-label="내가 찜한 점심 메뉴" className="space-y-6">
            <div className="border-b border-stone-200 pb-5">
              <p className="text-xs font-semibold text-orange-700 mb-1">
                나만의 점심 리스트
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900">
                찜한 점심 메뉴 ({savedMenus.length}개)
              </h1>
              <p className="text-sm text-stone-600 mt-1">
                마음에 드는 메뉴를 저장해 두고 동료에게 보여주거나 내일 점심 메뉴로 골라보세요.
              </p>
            </div>

            {savedMenus.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200/90 p-10 text-center space-y-4">
                <p className="font-display text-lg font-semibold text-stone-800">
                  아직 찜한 점심 메뉴가 없습니다.
                </p>
                <p className="text-sm text-stone-500">
                  맞춤 추천 화면에서 마음에 드는 메뉴의 ‘찜하기’ 버튼을 눌러 저장해 보세요.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection('recommend')}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors"
                >
                  맞춤 추천 받으러 가기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedMenus.map((menu) => (
                  <article
                    key={menu.id}
                    className="bg-white rounded-2xl border border-stone-200/90 p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-orange-700">
                            {menu.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{menu.spicyLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">약 {menu.calories}kcal</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSaved(menu.id)}
                          className="min-h-[36px] px-2 text-xs text-stone-400 hover:text-stone-700"
                        >
                          삭제
                        </button>
                      </div>

                      <div className="flex items-baseline justify-between gap-2 mb-2">
                        <h2 className="font-display text-lg font-semibold text-stone-900">
                          {menu.name}
                        </h2>
                        <span className="font-mono text-sm font-semibold text-stone-900 tabular-nums">
                          약 {menu.estimatedPrice.toLocaleString()}원
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 leading-relaxed">
                        {menu.summary}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-500">
                      <span className="font-semibold text-stone-700 mr-1.5">
                        꿀팁 ·
                      </span>
                      <span>{menu.pairingTip}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-stone-200/80 py-6 px-4 sm:px-8 mt-12 text-xs text-stone-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>오늘점심 · 직장인과 학생을 위한 맞춤 점심 메뉴 추천 웹앱</span>
          <span>오늘의 기분 · 다이어트 여부 · 음식 종류 · 예산 · 맵기 · 식사 인원 맞춤 큐레이션</span>
        </div>
      </footer>
    </div>
  );
}
