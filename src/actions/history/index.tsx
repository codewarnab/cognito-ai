import { useSearchHistory } from "./searchHistory";
import { useGetUrlVisits } from "./getUrlVisits";

export function registerHistoryActions() {
    useSearchHistory();
    useGetUrlVisits();
}
