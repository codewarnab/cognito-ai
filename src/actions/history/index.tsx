import { useSearchHistory } from "./searchHistory";
import { useGetUrlVisits } from "./getUrlVisits";
import { useGetRecentHistory } from "./getRecentHistory";

export function registerHistoryActions() {
    useSearchHistory();
    useGetUrlVisits();
    useGetRecentHistory();
}
